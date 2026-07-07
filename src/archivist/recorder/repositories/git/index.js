/**
 * This module is the boundary beyond which the usage of git is abstracted.
 * Commit SHAs are used as opaque unique IDs.
 */

import fsApi from 'fs';
import path from 'path';

import mime from 'mime';

import RepositoryInterface from '../interface.js';

import * as DataMapper from './dataMapper.js';
import Git from './git.js';

const fs = fsApi.promises;

const RECORD_ID_REGEXP = /^[0-9a-f]{7,40}$/i; // Git commit SHA 7 (abbreviated) to 40 (full) hexadecimal characters. Prevent value such as `--output=…` to be parsed as a command-line option

const CONTROL_CHARACTERS_REGEXP = /\p{Cc}/u; // Matches any Unicode "control" character: the C0 range (U+0000 to U+001F), DEL (U+007F) and the C1 range (U+0080 to U+009F), i.e. 65 non-printable characters including NUL. The `u` flag is required for the `\p{...}` property escape to be recognised, otherwise the pattern would match the literal text `p{Cc}`. Legitimate service IDs, terms types and document IDs never contain these, and NUL in particular can truncate a value once it reaches git or the filesystem, so any segment holding one is rejected.

// Keeps hostile values from reaching git, where a pathspec that resolves outside the repository (such as `../foo/*`) aborts with an error that exposes the repository location.
function isPlainPathSegment(segment) {
  return segment.length > 0
    && segment !== '.'
    && segment !== '..'
    && !segment.includes('/')
    && !segment.includes('\\')
    && !CONTROL_CHARACTERS_REGEXP.test(segment);
}

function canMatchRecordFilePath(...pathSegments) {
  // A non-string segment means "not provided" (`undefined`, or `false` for an absent document ID) and constrains nothing
  return pathSegments.every(segment => typeof segment !== 'string' || isPlainPathSegment(segment));
}

export default class GitRepository extends RepositoryInterface {
  constructor({ path, author, publish, snapshotIdentiferTemplate }) {
    super();
    this.path = path;
    this.needsPublication = publish;
    this.git = new Git({ path: this.path, author });
    this.snapshotIdentiferTemplate = snapshotIdentiferTemplate;
  }

  async initialize() {
    await this.git.initialize();
    await this.git.cleanUp(); // Drop all uncommitted changes and remove all leftover files that may be present if the process was killed aggressively
    await this.git.writeCommitGraph(); // Create or replace the commit graph with a new one to ensure it's fully consistent

    return this;
  }

  async save(record) {
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
    if (this.needsPublication) {
      await this.git.pushChanges();
    }

    return this.git.updateCommitGraph();
  }

  async findLatest(serviceId, termsType, documentId) {
    if (!canMatchRecordFilePath(serviceId, termsType, documentId)) {
      return null;
    }

    const matchingFilesPaths = await this.git.listFiles(DataMapper.generateFilePath(serviceId, termsType, documentId));

    if (!matchingFilesPaths.length) {
      return null;
    }

    const commit = await this.git.getCommit([...matchingFilesPaths]); // Returns the most recent commit that modified any of the matching files. If multiple files match the path pattern (e.g. both HTML and PDF versions exist), returns the commit that last modified any of them

    return this.#toDomain(commit);
  }

  async findByDate(serviceId, termsType, date, documentId) {
    if (!canMatchRecordFilePath(serviceId, termsType, documentId)) {
      return null;
    }

    const filePath = DataMapper.generateFilePath(serviceId, termsType, documentId);
    const commit = await this.git.getCommit([ `--until=${date?.toISOString()}`, '--', filePath ]);

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

    const pathPattern = DataMapper.generateFilePath(serviceId, termsType);

    return Promise.all((await this.#getCommits({ pathFilter: pathPattern, limit, offset, includeTechnicalUpgrades })).map(commit => this.#toDomain(commit, { deferContentLoading: true })));
  }

  async findByService(serviceId, { limit, offset, includeTechnicalUpgrades = true } = {}) {
    if (!canMatchRecordFilePath(serviceId)) {
      return [];
    }

    const pathPattern = DataMapper.generateFilePath(serviceId);

    return Promise.all((await this.#getCommits({ pathFilter: pathPattern, limit, offset, includeTechnicalUpgrades })).map(commit => this.#toDomain(commit, { deferContentLoading: true })));
  }

  async getNavigationIds(serviceId, termsType, versionId, { includeTechnicalUpgrades = true } = {}) {
    if (!canMatchRecordFilePath(serviceId, termsType)) {
      return { first: null, prev: null, next: null, last: null };
    }

    const pathPattern = DataMapper.generateFilePath(serviceId, termsType);
    let revisions = await this.git.listPathRevisions(pathPattern); // single lean walk of the terms history

    if (!includeTechnicalUpgrades) {
      revisions = revisions.filter(revision => !DataMapper.isTechnicalUpgrade(revision.subject));
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

    const grepOptions = Object.values(DataMapper.COMMIT_MESSAGE_PREFIXES).map(prefix => `--grep=${prefix}`);
    const pathOptions = [];

    if (serviceId && termsType) {
      const pathPattern = DataMapper.generateFilePath(serviceId, termsType);

      pathOptions.push('--', pathPattern);
    } else if (serviceId) {
      const pathPattern = DataMapper.generateFilePath(serviceId);

      pathOptions.push('--', pathPattern);
    } else {
      pathOptions.push('--', '*/*'); // Count all records (exclude root directory files)
    }

    return (await this.git.log([ ...grepOptions, ...pathOptions ])).length;
  }

  async* iterate() {
    const commits = await this.#getCommits({ reverse: true });

    for (const commit of commits) {
      yield this.#toDomain(commit);
    }
  }

  removeAll() {
    return this.git.destroyHistory();
  }

  async loadRecordContent(record) {
    const relativeFilePath = DataMapper.generateFilePath(record.serviceId, record.termsType, record.documentId, record.mimeType);

    if (record.mimeType != mime.getType('pdf')) {
      record.content = await this.git.show(`${record.id}:${relativeFilePath}`);

      return;
    }

    // In case of PDF files, `git show` cannot be used as it converts PDF binary into strings that do not retain the original binary representation
    // It is impossible to restore the original binary data from the resulting string
    let pdfBuffer;

    try {
      await this.git.restore(relativeFilePath, record.id); // Temporarily restore the PDF file to a specific commit
      pdfBuffer = await fs.readFile(`${this.path}/${relativeFilePath}`); // …read the content
    } finally {
      await this.git.restore(relativeFilePath, 'HEAD'); // …and finally restore the file to its most recent state
    }

    record.content = pdfBuffer;
  }

  getDiffStats(recordId) {
    return this.git.getDiffStats(recordId);
  }

  async #getCommits({ pathFilter, reverse = false, limit, offset, includeTechnicalUpgrades = true } = {}) {
    const prefixes = includeTechnicalUpgrades
      ? DataMapper.COMMIT_MESSAGE_PREFIXES
      : DataMapper.CHANGE_COMMIT_MESSAGE_PREFIXES;
    const grepOptions = Object.values(prefixes).flatMap(prefix => [ '--grep', prefix ]);
    const pathOptions = pathFilter
      ? [ '--', pathFilter ]
      : [ '--', '*/*' ]; // Exclude root directory files by only matching files in subdirectories

    const options = [ ...grepOptions, ...pathOptions ];

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
