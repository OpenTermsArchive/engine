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

mime.define({ 'text/markdown': ['md'] }, true); // ensure extension for markdown files is `.md` and not `.markdown`

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

    return this;
  }

  async save(record) {
    const { serviceId, termsType, documentId, fetchDate } = record;

    if (record.isFirstRecord === undefined || record.isFirstRecord === null) {
      record.isFirstRecord = !await this.#isTracked(serviceId, termsType, documentId);
    }

    const { message, content, filePath: relativeFilePath } = await this.#toPersistence(record);

    const filePath = path.join(this.path, relativeFilePath);

    await GitRepository.writeFile({ filePath, content });
    const sha = await this.commit({ filePath, message, date: fetchDate });

    if (!sha) {
      return Object(null);
    }

    record.id = sha;

    return record;
  }

  finalize() {
    if (!this.needsPublication) {
      return;
    }

    return this.git.pushChanges();
  }

  async findLatest(serviceId, termsType, documentId) {
    const filePath = DataMapper.generateFilePath(serviceId, termsType, documentId);
    const commit = await this.git.getCommit([filePath]);

    return this.#toDomain(commit);
  }

  async findById(recordId) {
    const commit = await this.git.getCommit([recordId]);

    return this.#toDomain(commit);
  }

  async findAll() {
    return Promise.all((await this.#getCommits()).map(commit => this.#toDomain(commit, { deferContentLoading: true })));
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

  async removeAll() {
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

  async #getCommits() {
    return (await this.git.listCommits())
      .filter(({ message }) => message.match(DataMapper.COMMIT_MESSAGE_PREFIXES_REGEXP)) // Skip commits which are not a record (README, LICENSE…)
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

  async commit({ filePath, message, date }) {
    try {
      await this.git.add(filePath);

      return await this.git.commit({ filePath, message, date });
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
