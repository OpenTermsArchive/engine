import fsApi from 'fs';
import path from 'path';

import Git from '../../git/index.js';
import { isPortableFileName } from '../../git/pathSegment.js';

import * as RunMapper from './run/dataMapper.js';
import * as TermsResultMapper from './terms-result/dataMapper.js';

const fs = fsApi.promises;

export default class TrackingResultsRepository {
  static create(storageConfig, { readOnly = false } = {}) { // Interprets the storage configuration for both the tracker and the readers
    if (storageConfig.type !== 'git') { // Git is the only supported backend, as the audit trail relies on its tamper-evident properties
      throw new Error(`Unsupported tracking-results storage type "${storageConfig.type}"; only "git" is supported`);
    }

    return new TrackingResultsRepository({ ...storageConfig.git, readOnly });
  }

  constructor({ path: repositoryPath, author, publish, readOnly = false }) {
    this.path = path.resolve(process.cwd(), repositoryPath); // Same resolution as RepositoryFactory: configured storage paths are project-relative and must not depend on the cwd of downstream git processes
    this.needsPublication = publish;
    this.readOnly = readOnly; // Readers share the repository with the tracker, so they must never touch the working tree nor the commit-graph, and never run the crash recovery, which is only safe for the single writer
    this.git = new Git({ path: this.path, author });
  }

  async initialize() {
    if (this.readOnly) { // Unlike snapshots and versions, a missing repository is not an error for readers: the tracker creates it at its first run, and tracking-results can be disabled
      return this;
    }

    await this.git.initialize();
    await this.git.cleanUp(); // Drop any uncommitted leftovers that would otherwise pollute the next commit
    await this.git.writeCommitGraph(); // Keep the commit graph in sync with the existing history for fast log operations

    return this;
  }

  async finalize() {
    this.assertWritable('finalize');

    if (this.needsPublication) {
      await this.git.pushChanges();
    }

    return this.git.updateCommitGraph();
  }

  async removeAll() { // Test-only: destroys all history
    this.assertWritable('remove all history');

    await this.git.destroyHistory();
  }

  async saveTermsResult(newResult, { trailers = {} } = {}) { // Trailers carry run-scoped context (e.g. x-run-id); they are not TermsResult state, so they are passed alongside rather than through the mapper
    newResult.validate();

    const { serviceId, termsType } = newResult;
    const absolutePath = path.join(this.path, TermsResultMapper.generateFilePath(serviceId, termsType));
    const previousContent = await readFile(absolutePath);
    const previousResult = previousContent === null ? null : TermsResultMapper.toDomain({ serviceId, termsType, data: parseJson(previousContent, absolutePath) });
    const persistence = TermsResultMapper.toPersistence(newResult, previousResult);

    if (!persistence) { // No substantive change between previous and new state, nothing to commit
      return { sha: null, eventType: null };
    }

    const sha = await this.commit({ ...persistence, trailers, previousContent }); // The content read for the comparison doubles as the rollback backup, sparing a second read

    return { sha, eventType: persistence.eventType };
  }

  saveRun(run, { trailers = {} } = {}) {
    run.validate();

    return this.commit({ ...RunMapper.toPersistence(run), trailers });
  }

  async findLatestTermsResult(serviceId, termsType) {
    const data = await readJsonFile(path.join(this.path, TermsResultMapper.generateFilePath(serviceId, termsType)));

    return data === null ? null : TermsResultMapper.toDomain({ serviceId, termsType, data });
  }

  async findLatestRun() {
    const data = await readJsonFile(path.join(this.path, RunMapper.FILE_NAME));

    return data === null ? null : RunMapper.toDomain(data);
  }

  async findLatestRunCommitSha() { // Returns the SHA of the latest commit that touched run.json; when the latest run is in_progress, this is the run-start commit and is used as the reference point for crash recovery
    const [commit] = await this.git.listCommits([ '--', RunMapper.FILE_NAME ], { reverse: false, maxCount: 1 });

    return commit?.hash ?? null;
  }

  async findLatestCompletedRunCommit() { // Readers serve the state recorded by the latest completed run, as a run in progress or crashed has only partially updated the terms results
    if (!fsApi.existsSync(path.join(this.path, '.git'))) { // Checked at each call so that readers started before the first run do not need a restart, and so that git never falls back on an enclosing repository
      return null;
    }

    const commit = await Git.getLatestCommitSha(this.path, { grep: `^${RunMapper.COMPLETED_RUN_MESSAGE_PREFIX}`, filePath: RunMapper.FILE_NAME });

    return commit;
  }

  async findRunAt(commit) {
    const content = await Git.readFileAtCommit(this.path, commit, RunMapper.FILE_NAME);

    return RunMapper.toDomain(parseJson(content, `${RunMapper.FILE_NAME} at ${commit}`));
  }

  async findTermsResultsAt(commit, { serviceId } = {}) { // Lists the terms results as they were at the given commit, optionally restricted to a service; files of terms removed from the declarations are kept as a historical record, and so are listed too
    if (this.termsResultsAtCommit?.commit !== commit) { // The results at a given commit never change, so the read of the latest commit requested is kept, and shared with the requests arriving while it is pending, as readers request the same commit until the next run completes
      this.termsResultsAtCommit = { commit, termsResults: readTermsResultsAt(this.path, commit) };
    }

    const { termsResults: pendingTermsResults } = this.termsResultsAtCommit; // Captured before waiting, as a request for another commit may replace the kept read meanwhile

    try {
      const termsResults = await pendingTermsResults;

      return serviceId === undefined ? [...termsResults] : termsResults.filter(termsResult => termsResult.serviceId === serviceId);
    } catch (error) {
      if (this.termsResultsAtCommit?.termsResults === pendingTermsResults) { // A failed read is not kept, so that the next request tries again
        this.termsResultsAtCommit = null;
      }

      throw error;
    }
  }

  async findTermsResultAt(commit, serviceId, termsType) {
    if (!isPortableFileName(serviceId) || !isPortableFileName(termsType)) { // Such identifiers cannot name a file of the repository, as its files are only written with portable names, and must not reach git
      return null;
    }

    const [content] = await Git.readFilesAtCommit(this.path, commit, [TermsResultMapper.generateFilePath(serviceId, termsType)]);

    return content === null ? null : TermsResultMapper.toDomain({ serviceId, termsType, data: parseJson(content, `${serviceId}/${termsType} at ${commit}`) });
  }

  async findCommittedTermsResultsSince(sha) { // Lists each distinct (serviceId, termsType) pair that had at least one per-terms commit between `sha` (exclusive) and HEAD (inclusive)
    if (!sha) {
      return [];
    }

    const commits = await this.git.listCommits([ `${sha}..HEAD`, '--', '*/*.json' ], { reverse: false }); // The pathspec excludes root-level files such as run.json
    const files = new Set(commits.flatMap(commit => commit.diff?.files.map(({ file }) => file) ?? []).filter(file => file.endsWith('.json'))); // Listed names are never C-quoted by git: every file here was written by saveTermsResult, whose validation rejects each character git quotes (double quote, backslash, control characters)

    return [...files].map(file => ({ serviceId: path.posix.dirname(file), termsType: path.posix.basename(file, '.json') }));
  }

  async commit({ filePath: relativePath, content, message, date, trailers, previousContent }) {
    this.assertWritable('commit');

    const absolutePath = path.join(this.path, relativePath);
    const backupContent = previousContent === undefined ? await readFile(absolutePath) : previousContent; // Read only when the caller does not already hold the previous content; null means the file is known to be absent

    try {
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content);
      await this.git.add(absolutePath);

      return await this.git.commit({ filePath: absolutePath, message, date, trailers });
    } catch (error) {
      await (backupContent === null ? fs.rm(absolutePath, { force: true }) : fs.writeFile(absolutePath, backupContent)).catch(() => {}); // Readers rely on the working tree matching HEAD, so a content that was not committed must not stay in it. Restored through the file system as git may be the very cause of the failure; best effort, as the next initialization cleans up anyway
      throw new Error(`Could not commit "${relativePath}" with message "${message}": ${error.message}`, { cause: error }); // Preserve the original stack via `cause` so operators can trace back to the underlying simple-git or fs error
    }
  }

  assertWritable(operation) {
    if (this.readOnly) {
      throw new Error(`Cannot ${operation} in the read-only tracking-results repository ${this.path}`);
    }
  }
}

async function readTermsResultsAt(repositoryPath, commit) {
  const files = (await Git.listFilesAtCommit(repositoryPath, commit, { recursive: true }))
    .map(filePath => ({ filePath, ...TermsResultMapper.parseFilePath(filePath) }))
    .filter(file => file.serviceId);

  const contents = await Git.readFilesAtCommit(repositoryPath, commit, files.map(({ filePath }) => filePath));

  return files.map(({ filePath, serviceId, termsType }, index) => TermsResultMapper.toDomain({ serviceId, termsType, data: parseJson(contents[index], `${filePath} at ${commit}`) }));
}

async function readFile(absolutePath) { // Resolves to null when the file does not exist, while other I/O failures are propagated
  try {
    return await fs.readFile(absolutePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function readJsonFile(absolutePath) { // Resolves to null when the file does not exist, while parse errors are propagated
  const content = await readFile(absolutePath);

  if (content === null) {
    return null;
  }

  return parseJson(content, absolutePath);
}

function parseJson(content, location) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Could not parse JSON in "${location}": ${error.message}`, { cause: error });
  }
}
