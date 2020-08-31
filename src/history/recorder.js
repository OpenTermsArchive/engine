/**
* This file is the boundary beyond which the usage of git is abstracted.
* Commit SHAs are used as opaque unique IDs.
*/

import fsApi from 'fs';

import mime from 'mime';

import Git from './git.js';

const fs = fsApi.promises;

export default class Recorder {
  constructor({ path, fileExtension }) {
    this.path = path;
    this.fileExtension = fileExtension;
    this.git = new Git(this.path);
  }

  async record({ serviceId, documentType, content, changelog, mimeType }) {
    const fileExtension = mime.getExtension(mimeType);
    const filePath = await this.save({ serviceId, documentType, content, fileExtension });
    const sha = await this.commit(filePath, changelog);

    return {
      path: filePath,
      id: sha,
    };
  }

  async save({ serviceId, documentType, content, fileExtension }) {
    const directory = `${this.path}/${serviceId}`;

    if (!await fileExists(directory)) {
      await fs.mkdir(directory, { recursive: true });
    }

    const filePath = this.getPathFor(serviceId, documentType, fileExtension);

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
    const filePath = this.getPathFor(serviceId, documentType, '*');
    const [ latestCommit ] = await this._getCommits(filePath);

    if (!latestCommit) {
      return {};
    }

    const [ relativeFilePath, ...otherFilesPaths ] = await this.git.filesInCommit(latestCommit.hash);

    if (otherFilesPaths.length) {
      throw new Error(`Only one document of type ${documentType} should have been recorded in ${latestCommit.hash}, but these additional ones have also been recorded: ${otherFilesPaths}`);
    }

    return {
      id: latestCommit.hash,
      content: await fs.readFile(`${this.path}/${relativeFilePath}`),
      mimeType: mime.getType(relativeFilePath)
    };
  }

  getPathFor(serviceId, documentType, fileExtension) {
    return `${this.path}/${serviceId}/${documentType}.${fileExtension || this.fileExtension}`;
  }

  async isTracked(serviceId, documentType) {
    const filePath = this.getPathFor(serviceId, documentType, '*');
    return this.git.isTracked(filePath);
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
