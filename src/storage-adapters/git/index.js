/**
 * This file is the boundary beyond which the usage of git is abstracted.
 * Commit SHAs are used as opaque unique IDs.
 */

import fsApi from 'fs';
import path from 'path';

import mime from 'mime';

import Git from './git.js';

const fs = fsApi.promises;

const COMMIT_MESSAGE_PREFIX = {
  startTracking: 'Start tracking',
  refilter: 'Refilter',
  update: 'Update',
};
const COMMIT_MESSAGE_PREFIXES_REGEXP = new RegExp(`^(${COMMIT_MESSAGE_PREFIX.startTracking}|${COMMIT_MESSAGE_PREFIX.refilter}|${COMMIT_MESSAGE_PREFIX.update})`);

const PDF_MIME_TYPE = 'application/pdf';

export default class GitAdapter {
  constructor({ path, author, publish, prefixMessageToSnapshotId }) {
    this.path = path;
    this.author = author;
    this.needsPublication = publish;
    this.prefixMessageToSnapshotId = prefixMessageToSnapshotId;

    mime.define({ 'text/markdown': ['md'] }, true); // ensure extension for markdown files is `.md` and not `.markdown`
  }

  async initialize(options = {}) {
    this.git = new Git({ path: this.path, author: this.author });

    await this.git.initialize();

    const readmeFilePath = `${this.path}/README.md`;

    if (options.readme) {
      await fs.writeFile(readmeFilePath, options.readme);
      await this._commit(readmeFilePath, 'Add README');
    }

    return this;
  }

  async record({ serviceId, documentType, content, mimeType, fetchDate, isRefilter, snapshotId }) {
    if (content instanceof Promise) {
      content = await content;
    }
    const isFirstRecord = await this._isFirstRecord(serviceId, documentType);
    const message = this._generateCommitMessage({ serviceId, documentType, isRefilter, snapshotId, isFirstRecord });
    const fileExtension = mime.getExtension(mimeType);
    const filePath = await this._save({ serviceId, documentType, content, fileExtension });
    const sha = await this._commit(filePath, message, fetchDate);

    if (!sha) {
      return {};
    }

    return {
      id: sha,
      isFirstRecord,
    };
  }

  finalize() {
    if (!this.needsPublication) {
      return;
    }

    return this.git.pushChanges();
  }

  async getLatest(serviceId, documentType) {
    const [commit] = await this.git.log([ '-1', `${serviceId}/${documentType}.*` ]);

    return this._convertCommitToRecord(commit);
  }

  async get(recordId) {
    const [commit] = await this.git.log([ '-1', recordId ]);

    return this._convertCommitToRecord(commit);
  }

  async getAll() {
    return Promise.all((await this._getRecordsCommitsAscending())
      .map(this._convertCommitToRecord.bind(this)));
  }

  async count() {
    return Number((await this.git.raw([ 'rev-list', '--count', 'HEAD' ])).trim());
  }

  async* iterate() {
    const commits = await this._getRecordsCommitsAscending();

    for (const commit of commits) {
      yield this._convertCommitToRecord(commit);
    }
  }

  async _getRecordsCommitsAscending() {
    return (await this.git.log([ '--reverse', '--no-merges' ]))
      .filter(({ message }) => message.match(COMMIT_MESSAGE_PREFIXES_REGEXP)) // Skip commits which are not a document record (README, LICENSE, …)
      .sort((commitA, commitB) => new Date(commitA.date) - new Date(commitB.date)); // Make sure that the commits are sorted in ascending order
  }

  async _save({ serviceId, documentType, content, fileExtension }) {
    const directory = `${this.path}/${serviceId}`;

    if (!fsApi.existsSync(directory)) {
      await fs.mkdir(directory, { recursive: true });
    }

    const filePath = this._getPathFor(serviceId, documentType, fileExtension);

    await fs.writeFile(filePath, content);

    return filePath;
  }

  async _commit(filePath, message, authorDate) {
    try {
      await this.git.add(filePath);

      return await this.git.commit(filePath, message, authorDate);
    } catch (error) {
      throw new Error(`Could not commit ${filePath} with message "${message}" due to error: "${error}"`);
    }
  }

  _getPathFor(serviceId, documentType, fileExtension) {
    return `${this.path}/${serviceId}/${documentType}.${fileExtension}`;
  }

  _isTracked(serviceId, documentType) {
    const filePath = this._getPathFor(serviceId, documentType, '*');

    return this.git.isTracked(filePath);
  }

  async _isFirstRecord(serviceId, documentType) {
    return !await this._isTracked(serviceId, documentType);
  }

  _generateCommitMessage({ serviceId, documentType, isRefilter, snapshotId, isFirstRecord }) {
    let prefix = isRefilter ? COMMIT_MESSAGE_PREFIX.refilter : COMMIT_MESSAGE_PREFIX.update;

    prefix = isFirstRecord ? COMMIT_MESSAGE_PREFIX.startTracking : prefix;

    let message = `${prefix} ${serviceId} ${documentType}`;

    if (snapshotId) {
      message = `${message}\n\n${this.prefixMessageToSnapshotId}${snapshotId}`;
    }

    return message;
  }

  async _convertCommitToRecord(commit) {
    if (!commit || !commit.hash) {
      return {};
    }

    const { hash, date, message, body } = commit;

    const modifiedFilesInCommit = (await this.git.show([ '--name-only', '--pretty=', hash ])).trim().split('\n');

    if (modifiedFilesInCommit.length > 1) {
      throw new Error(`Only one document should have been recorded in ${hash}, but all these documents were recorded: ${modifiedFilesInCommit.join(', ')}`);
    }

    const [relativeFilePath] = modifiedFilesInCommit;

    const snapshotIdMatch = body.match(/\b[0-9a-f]{5,40}\b/g);
    const adapter = this;

    return {
      id: hash,
      serviceId: path.dirname(relativeFilePath),
      documentType: path.basename(relativeFilePath, path.extname(relativeFilePath)),
      mimeType: mime.getType(relativeFilePath),
      fetchDate: new Date(date),
      isFirstRecord: message.startsWith(COMMIT_MESSAGE_PREFIX.startTracking),
      isRefilter: message.startsWith(COMMIT_MESSAGE_PREFIX.refilter),
      snapshotId: snapshotIdMatch && snapshotIdMatch[0],
      get content() { // In this scope, `this` is the `result` object, not the adapter
        return (async () => {
          if (this.mimeType != PDF_MIME_TYPE) {
            return adapter.git.show(`${hash}:${relativeFilePath}`);
          }

          // In case of PDF, `git show` cannot be used as it converts PDF binary into string which not retain the original binary representation
          // It is impossible to restore the original binary data from the resulting string
          let pdfBuffer;

          try {
            await adapter.git.raw([ 'restore', '-s', hash, '--', relativeFilePath ]); // So, temporarily restore the PDF file to a specific commit
            pdfBuffer = await fs.readFile(`${adapter.path}/${relativeFilePath}`); // …read the content
          } finally {
            await adapter.git.raw([ 'restore', '-s', 'HEAD', '--', relativeFilePath ]); // …and finally restore the file to its last state.
          }

          return pdfBuffer;
        })();
      },
    };
  }

  async _removeAll() {
    const files = await fs.readdir(this.path, { withFileTypes: true });
    const promises = files.map(file => {
      const filePath = path.join(this.path, file.name);

      if (file.isDirectory()) {
        return fs.rmdir(filePath, { recursive: true });
      }

      return fs.unlink(filePath);
    });

    await Promise.all(promises);

    return this.initialize();
  }
}
