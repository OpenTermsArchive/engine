/**
 * Persists tracking-results in a dedicated Git repository.
 * Git is the only supported backend, as the audit trail relies on its tamper-evident properties.
 */

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

  removeAll() { // Test-only: destroys all history. Never call from a request-handling code path.
    return this.git.destroyHistory();
  }

  async saveTermsResult(newResult, { trailers = {} } = {}) { // Trailers carry run-scoped context (e.g. x-run-id); they are not TermsResult state, so they are passed alongside rather than through the mapper
    newResult.validate();

    const previousResult = await this.findLatestTermsResult(newResult.serviceId, newResult.termsType);
    const persistence = TermsResultMapper.toPersistence(newResult, previousResult);

    if (!persistence) { // No substantive change between previous and new state, nothing to commit
      return { sha: null, eventType: null };
    }

    const sha = await this.commit({ ...persistence, trailers });

    return { sha, eventType: persistence.eventType };
  }

  // Not async because nothing needs to be awaited before calling commit; matches the Recorder.record pattern.
  // Unlike saveTermsResult (which derives the event type from a previous-vs-new comparison), saveRun takes the eventType explicitly: a run has no "previous run" to diff against in the same way; its lifecycle event is a state marker dictated by the caller (STARTED, COMPLETED, FINALIZED_CRASHED).
  saveRun(run, eventType, { trailers = {} } = {}) {
    run.validate();

    return this.commit({ ...RunMapper.toPersistence(run, eventType), trailers });
  }

  async findLatestTermsResult(serviceId, termsType) {
    const relativePath = TermsResultMapper.generateFilePath(serviceId, termsType);
    const absolutePath = path.join(this.path, relativePath);
    const data = await tryReadJsonFile(absolutePath);

    if (data === null) {
      return null;
    }

    return TermsResultMapper.toDomain({ serviceId, termsType, data });
  }

  async findAllTermsResults() {
    const results = [];
    const entries = await fs.readdir(this.path, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) {
        continue;
      }

      const serviceId = entry.name;
      const serviceDir = path.join(this.path, serviceId);
      const files = await fs.readdir(serviceDir);

      for (const fileName of files) {
        if (!fileName.endsWith('.json')) {
          continue;
        }

        const termsType = fileName.slice(0, -'.json'.length);
        const data = await readJsonFile(path.join(serviceDir, fileName));

        results.push(TermsResultMapper.toDomain({ serviceId, termsType, data }));
      }
    }

    return results;
  }

  async findLatestRun() {
    const absolutePath = path.join(this.path, RunMapper.FILE_NAME);
    const data = await tryReadJsonFile(absolutePath);

    if (data === null) {
      return null;
    }

    return RunMapper.toDomain(data);
  }

  async findLatestRunCommitSha() { // Returns the SHA of the latest commit that touched run.json; when the latest run is in_progress, this is the run-start commit and is used as the reference point for crash recovery
    const [commit] = await this.git.listCommits([ '--', RunMapper.FILE_NAME ], { reverse: false, maxCount: 1 });

    return commit?.hash ?? null;
  }

  async findCommittedTermsResultsSince(sha) { // Lists each (serviceId, termsType) pair that had at least one per-terms commit between `sha` (exclusive) and HEAD (inclusive). Deduplicates so a terms committed several times in the same window appears once
    if (!sha) {
      return [];
    }

    const commits = await this.git.listCommits([ `${sha}..HEAD`, '--', '*/*.json' ], { reverse: false });
    const seen = new Set();
    const results = [];

    for (const commit of commits) {
      for (const { file } of commit.diff?.files ?? []) {
        if (!file.endsWith('.json')) {
          continue;
        }

        const slashIndex = file.lastIndexOf('/');

        if (slashIndex === -1) { // Defensive: the `*/*.json` pathspec should already exclude root-level files like run.json
          continue;
        }

        const serviceId = file.slice(0, slashIndex);
        const termsType = file.slice(slashIndex + 1, -'.json'.length);
        const key = TermsResultMapper.termsKey(serviceId, termsType);

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        results.push({ serviceId, termsType });
      }
    }

    return results;
  }

  async commit({ filePath: relativePath, content, message, date, trailers }) {
    const absolutePath = path.join(this.path, relativePath);

    try {
      await ensureDirectory(path.dirname(absolutePath));
      await fs.writeFile(absolutePath, content);
      await this.git.add(absolutePath);

      return await this.git.commit({ filePath: absolutePath, message, date, trailers });
    } catch (error) {
      throw new Error(`Could not commit "${relativePath}" with message "${message}": ${error.message}`, { cause: error }); // Preserve the original stack via `cause` so operators can trace back to the underlying simple-git or fs error
    }
  }
}

async function ensureDirectory(dirPath) {
  if (!fsApi.existsSync(dirPath)) {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

async function readJsonFile(absolutePath) {
  const content = await fs.readFile(absolutePath, 'utf8');

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Could not parse JSON in "${absolutePath}": ${error.message}`, { cause: error });
  }
}

async function tryReadJsonFile(absolutePath) { // Variant of readJsonFile that treats a missing file as a non-error null result, while propagating parse errors and other I/O failures
  try {
    return await readJsonFile(absolutePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}
