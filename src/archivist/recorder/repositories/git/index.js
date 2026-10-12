/**
 * This module is the boundary beyond which the usage of git is abstracted.
 * Commit SHAs are used as opaque unique IDs.
 */

import fsApi from 'fs';
import path from 'path';

import mime from 'mime';

import Git from '../../../../git/index.js';
import { isPlainPathSegment } from '../../../../git/pathSegment.js';
import RepositoryInterface from '../interface.js';

import * as DataMapper from './dataMapper.js';
import HeadScopedCache from './headScopedCache.js';

const fs = fsApi.promises;

const RECORD_ID_REGEXP = /^[0-9a-f]{7,40}$/i; // Git commit SHA 7 (abbreviated) to 40 (full) hexadecimal characters. Prevent value such as `--output=…` to be parsed as a command-line option

function canMatchRecordFilePath(...pathSegments) {
  // A non-string segment means "not provided" (`undefined`, or `false` for an absent document ID) and constrains nothing
  return pathSegments.every(segment => typeof segment !== 'string' || isPlainPathSegment(segment));
}

function sortByFetchDate(revisions) {
  return revisions.sort((a, b) => b.timestamp - a.timestamp); // Stable, so revisions sharing a fetch date keep the order of the history, as with the previous date sort of the commits read from Git
}

function getRecordsGrepOptions({ includeTechnicalUpgrades = true } = {}) {
  const prefixes = includeTechnicalUpgrades ? DataMapper.COMMIT_MESSAGE_PREFIXES : DataMapper.CHANGE_COMMIT_MESSAGE_PREFIXES;

  return Object.values(prefixes).map(prefix => `--grep=${prefix}`);
}

export default class GitRepository extends RepositoryInterface {
  constructor({ path, author, publish, snapshotIdentiferTemplate, readOnly = false }) {
    super();
    this.path = path;
    this.needsPublication = publish;
    this.readOnly = readOnly; // Readers share the repository with the tracker, so they must never touch the working tree nor the commit-graph: both race the tracker, and the commit-graph write then fails with `commit-graph.lock: File exists`
    this.git = new Git({ path: this.path, author });
    this.snapshotIdentiferTemplate = snapshotIdentiferTemplate;
    this.cache = readOnly ? new HeadScopedCache() : null; // Only readers cache, as the writer moves HEAD at each record it saves
  }

  async initialize() {
    if (this.readOnly) {
      this.git.open();

      return this;
    }

    await this.git.initialize();
    await this.git.cleanUp(); // Drop all uncommitted changes and remove all leftover files that may be present if the process was killed aggressively
    await this.git.writeCommitGraph(); // Create or replace the commit graph with a new one to ensure it's fully consistent

    return this;
  }

  async save(record) {
    this.#assertWritable('save records');

    const { serviceId, termsType, documentId, fetchDate } = record;

    if (record.isFirstRecord === undefined || record.isFirstRecord === null) {
      record.isFirstRecord = !await this.#isTracked(serviceId, termsType, documentId);
    }

    const { message, content, filePath: relativeFilePath, metadata } = await this.#toPersistence(record);

    const filePath = path.join(this.path, relativeFilePath);

    await GitRepository.writeFile({ filePath, content });
    const sha = await this.#commit({ filePath, message, date: fetchDate, trailers: metadata });

    if (!sha) {
      return Object(null);
    }

    record.id = sha;

    return record;
  }

  async finalize() {
    if (this.readOnly) {
      return;
    }

    if (this.needsPublication) {
      await this.git.pushChanges();
    }

    return this.git.updateCommitGraph();
  }

  async findLatest(serviceId, termsType, documentId) {
    if (!canMatchRecordFilePath(serviceId, termsType, documentId)) {
      return null;
    }

    const filePathPrefix = DataMapper.generateFilePathPrefix(serviceId, termsType, documentId);
    const matchingFilesPaths = (await this.git.listFiles(`:(literal)${serviceId}/`)).filter(filePath => filePath.startsWith(filePathPrefix)); // A literal pathspec matches the directory of the service as is, whatever characters its name holds, such as `*` or `[`; the files of the requested terms are then picked in memory

    if (!matchingFilesPaths.length) {
      return null;
    }

    const commit = await this.git.getCommit([ '--', ...matchingFilesPaths.map(filePath => `:(literal)${filePath}`) ]); // Returns the most recent commit that modified any of the matching files. If multiple files match the path pattern (e.g. both HTML and PDF versions exist), returns the commit that last modified any of them

    return this.#toDomain(commit);
  }

  async findByDate(serviceId, termsType, date, documentId) {
    if (!canMatchRecordFilePath(serviceId, termsType, documentId)) {
      return null;
    }

    const revisions = await this.#listRevisions(serviceId, { termsType, documentId });
    const revision = revisions.find(({ commitTimestamp }) => commitTimestamp * 1000 <= date?.getTime()); // The latest commit of the history up to the date, as `git log -1 --until` returned; an invalid date matches none

    if (!revision) {
      return null;
    }

    const [commit] = await this.git.getCommitsByHashes([revision.hash], revision.filePaths);

    return this.#toDomain(commit);
  }

  async findById(recordId) {
    if (!RECORD_ID_REGEXP.test(recordId)) {
      return null;
    }

    const commit = await this.git.getCommit([ '--end-of-options', recordId ]); // `--end-of-options` forces git to treat `recordId` as a revision, never as an option: a second line of defence that keeps the lookup safe from argument injection even if the format guard above is ever relaxed

    return this.#toDomain(commit);
  }

  async findMetadataById(recordId) {
    if (!RECORD_ID_REGEXP.test(recordId)) {
      return null;
    }

    const commit = await this.git.getCommit([ '--end-of-options', recordId ]); // `--end-of-options` forces git to treat `recordId` as a revision, never as an option: a second line of defence that keeps the lookup safe from argument injection even if the format guard above is ever relaxed

    return this.#toDomain(commit, { deferContentLoading: true });
  }

  async findAll({ limit, offset, includeTechnicalUpgrades = true } = {}) {
    return Promise.all((await this.#getCommits({ limit, offset, includeTechnicalUpgrades })).map(commit => this.#toDomain(commit, { deferContentLoading: true })));
  }

  async findByServiceAndTermsType(serviceId, termsType, { limit, offset, includeTechnicalUpgrades = true } = {}) {
    if (!canMatchRecordFilePath(serviceId, termsType)) {
      return [];
    }

    return this.#loadRevisions(await this.#listRecords(serviceId, { termsType, includeTechnicalUpgrades }), { limit, offset });
  }

  async findByService(serviceId, { limit, offset, includeTechnicalUpgrades = true } = {}) {
    if (!canMatchRecordFilePath(serviceId)) {
      return [];
    }

    return this.#loadRevisions(await this.#listRecords(serviceId, { includeTechnicalUpgrades }), { limit, offset });
  }

  async getNavigationIds(serviceId, termsType, versionId, { includeTechnicalUpgrades = true } = {}) {
    if (!canMatchRecordFilePath(serviceId, termsType)) {
      return { first: null, prev: null, next: null, last: null };
    }

    let revisions = await this.#listRevisions(serviceId, { termsType });

    if (!includeTechnicalUpgrades) {
      revisions = revisions.filter(revision => !revision.isTechnicalUpgrade);
    }

    // Deterministic total order: most recent first, commit SHA as a stable tiebreaker for versions sharing the same fetch date (git stores second precision).
    // prev/next are then adjacent entries in this single order, so navigation always round-trips, unlike the previous chronological/topological mix.
    revisions.sort((a, b) => b.timestamp - a.timestamp || (a.hash < b.hash ? -1 : 1));

    const index = revisions.findIndex(revision => revision.hash === versionId);

    if (index === -1) {
      return { first: null, prev: null, next: null, last: null };
    }

    return {
      last: revisions[0].hash,
      first: revisions[revisions.length - 1].hash,
      next: index > 0 ? revisions[index - 1].hash : null,
      prev: index < revisions.length - 1 ? revisions[index + 1].hash : null,
    };
  }

  async count(serviceId, termsType) {
    if (!canMatchRecordFilePath(serviceId, termsType)) {
      return 0;
    }

    if (serviceId) {
      return (await this.#listRecords(serviceId, { termsType })).length;
    }

    return this.#readAtHead('count:all', (revision, previous) => this.#countAllRecords(revision, previous));
  }

  async* iterate() {
    const commits = await this.#getCommits({ reverse: true });

    for (const commit of commits) {
      yield this.#toDomain(commit);
    }
  }

  async removeAll() {
    this.#assertWritable('remove records');

    await this.git.destroyHistory();
  }

  async loadRecordContent(record) {
    const relativeFilePath = DataMapper.generateFilePath(record.serviceId, record.termsType, record.documentId, record.mimeType);

    const objectPath = `${record.id}:${relativeFilePath}`;

    record.content = record.mimeType == mime.getType('pdf')
      ? await this.git.showBuffer(objectPath) // Binary content is read straight from the object database, so nothing is ever written to the working tree shared with the tracker
      : await this.git.show(objectPath);
  }

  getDiffStats(recordId) {
    return this.git.getDiffStats(recordId);
  }

  async getDiffStatsBatch(recordIds) {
    const statsByHash = await this.git.getDiffStatsBatch(recordIds.filter(recordId => RECORD_ID_REGEXP.test(recordId))); // Only well-formed IDs reach git, as a single invalid one would fail the whole batch

    return new Map(recordIds.map(recordId => [ recordId, statsByHash.get(recordId) || { additions: null, deletions: null } ]));
  }

  async #listRevisions(serviceId, { termsType, documentId } = {}) {
    const filePathPrefix = DataMapper.generateFilePathPrefix(serviceId, termsType, documentId);
    const revisions = [];

    for (const { filePaths, ...revision } of await this.#listServiceRevisions(serviceId)) {
      const matchingFilePaths = filePaths.filter(filePath => filePath.startsWith(filePathPrefix)); // The files of the requested terms are picked in memory, including files deleted since, so that a single read serves all the terms of the service

      if (matchingFilePaths.length) {
        revisions.push({ ...revision, filePaths: matchingFilePaths });
      }
    }

    return revisions;
  }

  async #listRecords(serviceId, { termsType, includeTechnicalUpgrades = true } = {}) {
    return (await this.#listRevisions(serviceId, { termsType })).filter(revision => revision.filePaths.length == 1 && (includeTechnicalUpgrades ? revision.isRecord : revision.isChange)); // A commit that changed several files of the requested terms or service cannot be read as a single record
  }

  async #readAtHead(key, read) {
    const head = this.cache && await this.#readHead();

    if (!head) {
      return read('HEAD');
    }

    return this.cache.get(key, head, previous => read(head, previous)); // Read at the SHA rather than at HEAD, so that the result is stored under the exact state it was read from, even if the tracker records meanwhile
  }

  #readHead() {
    this.pendingHeadRead ??= this.git.getHeadSha().finally(() => { this.pendingHeadRead = null; }); // Shared by simultaneous calls and run by the reader's own Git, so that a burst of requests spawns a single process, within the limit of the reader

    return this.pendingHeadRead;
  }

  async #countAllRecords(revision, previous) {
    const grepOptions = getRecordsGrepOptions();

    if (previous && await this.git.isAncestor(previous.head, revision)) { // Only the commits added since the previous count need counting when the history was extended, unlike a rewritten one, such as after a force push
      const previousCount = await previous.promise.catch(() => null);

      if (previousCount !== null) {
        return previousCount + await this.git.countCommits([ ...grepOptions, `${previous.head}..${revision}`, '--', '*/*' ]);
      }
    }

    return this.git.countCommits([ ...grepOptions, revision, '--', '*/*' ]); // Count all records (exclude root directory files)
  }

  #listServiceRevisions(serviceId) {
    return this.#readAtHead(`revisions:${serviceId}`, async revision => {
      const revisions = await this.git.listPathRevisions(`:(literal)${serviceId}`, { revision }); // A literal pathspec matches the directory of the service as is, whatever characters its name holds, such as `*` or `[`, and lets git use the changed-path Bloom filters of the commit-graph, which wildcards disable

      return revisions.map(({ message, ...serviceRevision }) => ({
        ...serviceRevision,
        isRecord: DataMapper.hasRecordPrefix(message),
        isChange: DataMapper.hasRecordPrefix(message, { includeTechnicalUpgrades: false }),
        isTechnicalUpgrade: DataMapper.isTechnicalUpgrade(message),
      })); // Messages are reduced to the flags read from them, as the cache keeps the histories of hundreds of services
    });
  }

  async #loadRevisions(revisions, { limit, offset = 0 } = {}) {
    const page = sortByFetchDate(revisions.slice(offset, limit === undefined ? undefined : offset + limit)); // Paginated in the order of the history, as `#getCommits` does, until https://github.com/OpenTermsArchive/engine/issues/1243 settles how records should be paginated
    const commits = await this.git.getCommitsByHashes(page.map(({ hash }) => hash), [...new Set(page.flatMap(({ filePaths }) => filePaths))]);

    return Promise.all(commits.map(commit => this.#toDomain(commit, { deferContentLoading: true })));
  }

  async #getCommits({ reverse = false, limit, offset, includeTechnicalUpgrades = true } = {}) {
    const options = [ ...getRecordsGrepOptions({ includeTechnicalUpgrades }), '--', '*/*' ]; // Exclude root directory files by only matching files in subdirectories

    // Use git-level pagination for performance: `--skip` and `--max-count` count in topological order, not strictly chronological.
    // In records history, the only commits whose author date is out of step with their topological position are technical upgrades.
    // The only caller currently relying on pagination is the feed endpoint, which already filters technical upgrades out via `includeTechnicalUpgrades: false`, so the paginated set has no chronological/topological divergence in practice.
    // If a future caller needs paginated access that includes technical upgrades, switch to the approach proposed in https://github.com/OpenTermsArchive/engine/issues/1243.
    const paginationOptions = {};

    if (offset !== undefined) {
      paginationOptions.skip = offset;
    }

    if (limit !== undefined) {
      paginationOptions.maxCount = limit;
    }

    const commits = await this.git.listCommits(options, { reverse: false, ...paginationOptions }); // Get commits without git's --reverse for better performance, filtered at git level

    commits.sort((commitA, commitB) => {
      const dateA = new Date(commitA.date);
      const dateB = new Date(commitB.date);

      return reverse ? dateA - dateB : dateB - dateA;
    });

    return commits;
  }

  static async writeFile({ filePath, content }) {
    const directory = path.dirname(filePath);

    if (!fsApi.existsSync(directory)) {
      await fs.mkdir(directory, { recursive: true });
    }

    await fs.writeFile(filePath, content);

    return filePath;
  }

  async #commit({ filePath, message, date, trailers }) {
    try {
      await this.git.add(filePath);

      return await this.git.commit({ filePath, message, date, trailers });
    } catch (error) {
      throw new Error(`Could not commit ${filePath} with message "${message}" due to error: "${error}"`);
    }
  }

  #isTracked(serviceId, termsType, documentId) {
    return this.git.isTracked(`${this.path}/${DataMapper.generateFilePath(serviceId, termsType, documentId)}`);
  }

  #assertWritable(operation) {
    if (this.readOnly) {
      throw new Error(`Cannot ${operation} in read-only repository ${this.path}`);
    }
  }

  async #toDomain(commit, { deferContentLoading } = {}) {
    if (!commit) {
      return null;
    }

    const record = DataMapper.toDomain(commit);

    if (deferContentLoading) {
      return record;
    }

    await this.loadRecordContent(record);

    return record;
  }

  async #toPersistence(record) {
    if (record.content === undefined || record.content === null) {
      await this.loadRecordContent(record);
    }

    return DataMapper.toPersistence(record, this.snapshotIdentiferTemplate);
  }
}
