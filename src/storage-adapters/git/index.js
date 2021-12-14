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

    return this.git.initialize();
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
    };
  }

  async _save({ serviceId, documentType, content, fileExtension }) {
    const directory = `${this.path}/${serviceId}`;

    if (!(await fileExists(directory))) {
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

async function fileExists(filePath) {
  try {
    await fs.access(filePath);

    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
  }
}
