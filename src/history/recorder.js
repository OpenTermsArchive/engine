import fsApi from 'fs';

import Git from './git.js';

const fs = fsApi.promises;

export default class Recorder {
  constructor({ path, fileExtension }) {
    this.path = path;
    this.fileExtension = fileExtension;
    this.git = new Git(this.path);
  }

  async record({ serviceId, documentType, content, changelog }) {
    const filePath = await this.save({ serviceId, documentType, content });
    const sha = await this.commit(filePath, changelog);

    return {
      path: filePath,
      id: sha,
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
    const [ latestCommit ] = await this._getCommits(filePath);

    return {
      id: latestCommit && latestCommit.hash,
      path: filePath
    };
  }

  getPathFor(serviceId, documentType) {
    return `${this.path}/${serviceId}/${documentType}.${this.fileExtension}`;
  }

  async isTracked(serviceId, documentType) {
    const filePath = this.getPathFor(serviceId, documentType);

    if (!await fileExists(filePath)) {
      return false;
    }

    const isNew = await this.git.isNew(filePath);
    return !isNew;
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
