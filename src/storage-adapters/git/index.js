/**
 * This file is the boundary beyond which the usage of git is abstracted.
 * Commit SHAs are used as opaque unique IDs.
 */

import fsApi from 'fs';
import path from 'path';

import mime from 'mime';

import Git from './git.js';

const fs = fsApi.promises;

export default class GitAdapter {
  constructor({ path, fileExtension, author, publish, prefixMessageToSnapshotId }) {
    this.path = path;
    this.author = author;
    this.fileExtension = fileExtension;
    this.needsPublication = publish;
    this.prefixMessageToSnapshotId = prefixMessageToSnapshotId;
  }

  async initialize() {
    this.git = new Git({ path: this.path, author: this.author });

    await this.git.initialize();

    return this;
  }

  async record({ serviceId, documentType, content, mimeType, fetchDate, isRefilter, snapshotId }) {
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

  async getLatestRecord(serviceId, documentType) {
    const filePathGlob = this._getPathFor(serviceId, documentType, '*');
    const { commit, filePath } = await this.git.findUnique(filePathGlob);
    const recordFilePath = `${this.path}/${filePath}`;

    if (!commit || !filePath || !fsApi.existsSync(recordFilePath)) {
      return {};
    }

    const mimeType = mime.getType(filePath);
    const readFileOptions = {};

    if (mimeType.startsWith('text/')) {
      readFileOptions.encoding = 'utf8';
    }

    return {
      id: commit.hash,
      content: await fs.readFile(recordFilePath, readFileOptions),
      mimeType,
      fetchDate: new Date(commit.date),
      isRefilter: commit.message.startsWith('Refilter'),
    };
  }

  async* iterate() {
    const initialCommitHash = (await this.git.raw([ 'rev-list', '--max-parents=0', 'HEAD' ])).trim();
    const currentBranchName = (await this.git.raw([ 'rev-parse', '--abbrev-ref', 'HEAD' ])).trim();

    try {
      let previousCommitHash;

      /* eslint-disable no-await-in-loop */
      while (previousCommitHash != initialCommitHash) {
        const [{ hash, date, message, diff: { files: [{ file: relativeFilePath }] } }] = await this.git.log([ '-1', '--stat=4096' ]); // get current commit information

        if (message.match(/^(Start tracking|Update|Refilter)/)) { // Skip commits which are not a document versions (initial README or LICENSE commits for example)
          const absoluteFilePath = `${this.path}/${relativeFilePath}`;

          const serviceId = path.dirname(relativeFilePath);
          const extension = path.extname(relativeFilePath);
          const documentType = path.basename(relativeFilePath, extension);

          yield {
            id: hash,
            serviceId,
            documentType,
            content: await fs.readFile(absoluteFilePath, { encoding: 'utf8' }),
            fetchDate: new Date(date),
          };
        }

        previousCommitHash = hash;

        if (initialCommitHash != hash) {
          await this.git.checkout(['HEAD~1']); // checkout the parent commit
        }
      }
      /* eslint-enable no-await-in-loop */
    } finally {
      await this.git.checkout([currentBranchName]);
    }
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
    return `${this.path}/${serviceId}/${documentType}.${fileExtension || this.fileExtension}`;
  }

  _isTracked(serviceId, documentType) {
    const filePath = this._getPathFor(serviceId, documentType, '*');

    return this.git.isTracked(filePath);
  }

  async _isFirstRecord(serviceId, documentType) {
    return !await this._isTracked(serviceId, documentType);
  }

  _generateCommitMessage({ serviceId, documentType, isRefilter, snapshotId, isFirstRecord }) {
    let prefix = isRefilter ? 'Refilter' : 'Update';

    prefix = isFirstRecord ? 'Start tracking' : prefix;

    let message = `${prefix} ${serviceId} ${documentType}`;

    if (snapshotId) {
      message = `${message}\n\n${this.prefixMessageToSnapshotId}${snapshotId}`;
    }

    return message;
  }

  async _removeAllRecords() {
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
