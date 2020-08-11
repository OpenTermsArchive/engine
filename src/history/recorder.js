import fsApi from 'fs';

import async from 'async';

import Git from './git.js';

const fs = fsApi.promises;

export default class Recorder {
  constructor({ path, fileExtension }) {
    this.path = path;
    this.fileExtension = fileExtension;
    this.git = new Git(this.path);
    this.commitQueue = async.queue(this._commit.bind(this), 1);
    this.commitQueue.error(Recorder.commitQueueErrorHandler);
  }

  async record({ serviceId, documentType, content, details }) {
    const filePath = await this.save({ serviceId, documentType, content });
    const isNewFile = await this.git.isNew(filePath);

    let message = `${isNewFile ? 'Start tracking' : 'Update'} ${serviceId} ${documentType}`;

    if (details) {
      message += `\n\n${details}`;
    }

    const sha = await this.commit(filePath, message);

    return {
      path: filePath,
      id: sha,
      isFirstRecord: isNewFile
    };
  }

  async save({ serviceId, documentType, content }) {
    const directory = `${this.path}/${serviceId}`;

    if (!await fileExists(directory)) {
      await fs.mkdir(directory, { recursive: true });
    }

    const filePath = this._filePath(serviceId, documentType);

    await fs.writeFile(filePath, content);

    return filePath;
  }

  async commit(filePath, message) {
    if (!await this.git.hasChanges(filePath)) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.commitQueue.push({ filePath, message, resolve, reject });
    });
  }

  async _commit({ filePath, message, resolve }) {
    await this.git.add(filePath);
    resolve(await this.git.commit(filePath, message));
  }

  async publish() {
    return this.git.pushChanges();
  }

  _filePath(serviceId, documentType) {
    return `${this.path}/${serviceId}/${documentType}.${this.fileExtension}`;
  }

  async _getCommits(filePath) {
    const logSummary = await this.git.log({ file: filePath });
    return logSummary.all;
  }

  static commitQueueErrorHandler(error, { filePath, message, reject }) {
    reject(new Error(`Could not commit ${filePath} with message "${message}" due to error: "${error}"`));
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
