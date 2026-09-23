import fsApi from 'fs';
import path from 'path';

import Git from '../../git/index.js';

import * as RunMapper from './run/dataMapper.js';
import * as TermsResultMapper from './terms-result/dataMapper.js';

const fs = fsApi.promises;

export default class TrackingResultsRepository {
  constructor({ path: repositoryPath, author, publish }) {
    this.path = path.resolve(process.cwd(), repositoryPath); // Same resolution as RepositoryFactory: configured storage paths are project-relative and must not depend on the cwd of downstream git processes
    this.needsPublication = publish;
    this.git = new Git({ path: this.path, author });
  }

  async initialize() {
    await this.git.initialize();
    await this.git.cleanUp(); // Drop any uncommitted leftovers that would otherwise pollute the next commit
    await this.git.writeCommitGraph(); // Keep the commit graph in sync with the existing history for fast log operations

    return this;
  }

  async finalize() {
    if (this.needsPublication) {
      await this.git.pushChanges();
    }

    return this.git.updateCommitGraph();
  }

  removeAll() { // Test-only: destroys all history
    return this.git.destroyHistory();
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

  async findCommittedTermsResultsSince(sha) { // Lists each distinct (serviceId, termsType) pair that had at least one per-terms commit between `sha` (exclusive) and HEAD (inclusive)
    if (!sha) {
      return [];
    }

    const commits = await this.git.listCommits([ `${sha}..HEAD`, '--', '*/*.json' ], { reverse: false }); // The pathspec excludes root-level files such as run.json
    const files = new Set(commits.flatMap(commit => commit.diff?.files.map(({ file }) => file) ?? []).filter(file => file.endsWith('.json'))); // Listed names are never C-quoted by git: every file here was written by saveTermsResult, whose validation rejects each character git quotes (double quote, backslash, control characters)

    return [...files].map(file => ({ serviceId: path.posix.dirname(file), termsType: path.posix.basename(file, '.json') }));
  }

  async commit({ filePath: relativePath, content, message, date, trailers, previousContent }) {
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

function parseJson(content, absolutePath) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Could not parse JSON in "${absolutePath}": ${error.message}`, { cause: error });
  }
}
