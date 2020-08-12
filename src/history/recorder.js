import fsApi from 'fs';

import Git from './git.js';

const fs = fsApi.promises;

export default class Recorder {
  constructor({ path, fileExtension }) {
    this.path = path;
    this.fileExtension = fileExtension;
    this.git = new Git(this.path);
  }

  async record({ serviceId, documentType, content, details, isRefiltering }) {
    const filePath = await this.save({ serviceId, documentType, content });
    const isNewFile = await this.git.isNew(filePath);

    let prefix = isNewFile ? 'Start tracking' : 'Update';
    prefix = isRefiltering ? 'Refilter' : prefix;

    let message = `${prefix} ${serviceId} ${documentType}`;

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

    const filePath = this.getPathFor(serviceId, documentType);

    await fs.writeFile(filePath, content);

    return filePath;
  }

  async commit(filePath, message) {
    try {
      if (!await this.git.hasChanges(filePath)) {
        return;
      }

      await this.git.add(filePath);
      return await this.git.commit(filePath, message);
    } catch (error) {
      throw new Error(`Could not commit ${filePath} with message "${message}" due to error: "${error}"`);
    }
  }

  async publish() {
    return this.git.pushChanges();
  }

  async getLatestRecord(serviceId, documentType) {
    const filePath = this.getPathFor(serviceId, documentType);
    const commits = await this._getCommits(filePath);
    const result = { id: null, path: filePath };

    if (commits.length) {
      result.id = commits[0].hash;
    }

    return result;
  }

  getPathFor(serviceId, documentType) {
    return `${this.path}/${serviceId}/${documentType}.${this.fileExtension}`;
  }

  async _getCommits(filePath) {
    return this.git.log({ file: filePath });
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
