/**
 * This file is the boundary beyond which the usage of git is abstracted.
 * Commit SHAs are used as opaque unique IDs.
 */

import Git from './git.js';
import fsApi from 'fs';
import mime from 'mime';

const fs = fsApi.promises;

export default class Recorder {
  constructor({ path, fileExtension }) {
    this.path = path;
    this.fileExtension = fileExtension;
    this.git = new Git(this.path);
  }

  async init() {
    return this.git.initConfig();
  }

  async record({ serviceId, documentType, content, changelog, mimeType, authorDate }) {
    const fileExtension = mime.getExtension(mimeType);
    const filePath = await this.save({ serviceId, documentType, content, fileExtension });
    const sha = await this.commit(filePath, changelog, authorDate);

    return {
      path: filePath,
      id: sha,
    };
  }

  async save({ serviceId, documentType, content, fileExtension }) {
    const directory = `${this.path}/${serviceId}`;

    if (!(await fileExists(directory))) {
      await fs.mkdir(directory, { recursive: true });
    }

    const filePath = this.getPathFor(serviceId, documentType, fileExtension);

    await fs.writeFile(filePath, content);

    return filePath;
  }

  async commit(filePath, message, authorDate) {
    try {
      await this.git.add(filePath);
      return await this.git.commit(filePath, message, authorDate);
    } catch (error) {
      throw new Error(
        `Could not commit ${filePath} with message "${message}" due to error: "${error}"`
      );
    }
  }

  async publish() {
    return this.git.pushChanges();
  }

  async getLatestRecord(serviceId, documentType) {
    const filePathGlob = this.getPathFor(serviceId, documentType, '*');
    const { commit, filePath } = await this.git.findUnique(filePathGlob);

    if (!commit || !filePath) {
      return {};
    }

    const recordFilePath = `${this.path}/${filePath}`;
    const mimeType = mime.getType(filePath);

    if (!fsApi.existsSync(recordFilePath)) {
      return {};
    }

    const readFileOptions = {};
    if (mimeType.startsWith('text/')) {
      readFileOptions.encoding = 'utf8';
    }

    return {
      id: commit.hash,
      content: await fs.readFile(recordFilePath, readFileOptions),
      mimeType,
    };
  }

  getPathFor(serviceId, documentType, fileExtension) {
    return `${this.path}/${serviceId}/${documentType}.${fileExtension || this.fileExtension}`;
  }

  async isTracked(serviceId, documentType) {
    const filePath = this.getPathFor(serviceId, documentType, '*');
    return this.git.isTracked(filePath);
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
