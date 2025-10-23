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
    const matchingFilesPaths = await this.git.listFiles(DataMapper.generateFilePath(serviceId, termsType, documentId));

    if (!matchingFilesPaths.length) {
      return null;
    }

    const commit = await this.git.getCommit([...matchingFilesPaths]); // Returns the most recent commit that modified any of the matching files. If multiple files match the path pattern (e.g. both HTML and PDF versions exist), returns the commit that last modified any of them

    return this.#toDomain(commit);
  }

  async findByDate(serviceId, termsType, date, documentId) {
    const filePath = DataMapper.generateFilePath(serviceId, termsType, documentId);
    const commit = await this.git.getCommit([ `--until=${date?.toISOString()}`, filePath ]);

    return this.#toDomain(commit);
  }

  async findById(recordId) {
    const commit = await this.git.getCommit([recordId]);

    return this.#toDomain(commit);
  }

  async findAll() {
    return Promise.all((await this.#getCommits()).map(commit => this.#toDomain(commit, { deferContentLoading: true })));
  }

  async findByServiceAndTermsType(serviceId, termsType) {
    const pathPattern = DataMapper.generateFilePath(serviceId, termsType);

    return Promise.all((await this.#getCommits(pathPattern)).map(commit => this.#toDomain(commit, { deferContentLoading: true })));
  }

  async findFirst(serviceId, termsType) {
    const allVersions = await this.findByServiceAndTermsType(serviceId, termsType);

    return allVersions.length > 0 ? allVersions[0] : null;
  }

  async findPrevious(versionId) {
    const version = await this.findById(versionId);

    if (!version) {
      return null;
    }

    return this.findByDate(version.serviceId, version.termsType, new Date(version.fetchDate.getTime() - 1));
  }

  async findNext(versionId) {
    const version = await this.findById(versionId);

    if (!version) {
      return null;
    }

    const pathPattern = DataMapper.generateFilePath(version.serviceId, version.termsType);
    const currentTime = version.fetchDate.getTime();

    const commits = await this.git.listCommits([ `--since=${version.fetchDate.toISOString()}`, '--', pathPattern ]); // --since is inclusive

    const nextCommits = commits.filter(commit => new Date(commit.date).getTime() > currentTime); // Filter out commits not strictly after the current date

    if (nextCommits.length === 0) {
      return null;
    }

    return this.#toDomain(nextCommits[0], { deferContentLoading: true }); // First element is the one immediately after the current date (listCommits returns oldest first)
  }

  async count() {
    return (await this.git.log(Object.values(DataMapper.COMMIT_MESSAGE_PREFIXES).map(prefix => `--grep=${prefix}`))).length;
  }

  async* iterate() {
    const commits = await this.#getCommits();

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

  async #getCommits(pathFilter) {
    const options = pathFilter ? [ '--', pathFilter ] : [];

    return (await this.git.listCommits(options))
      .filter(commit => // Skip non-record commits (e.g., README or LICENSE updates)
        DataMapper.COMMIT_MESSAGE_PREFIXES_REGEXP.test(commit.message) // Commits generated by the engine have messages that match predefined prefixes
        && path.dirname(commit.diff.files[0].file) !== '.') // Assumes one record per commit; records must be in a serviceId folder, not root
      .sort((commitA, commitB) => new Date(commitA.date) - new Date(commitB.date)); // Make sure that the commits are sorted in ascending chronological order
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
