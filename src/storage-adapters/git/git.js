import fsApi from 'fs';
import path from 'path';

import simpleGit from 'simple-git';

process.env.LC_ALL = 'en_GB'; // Ensure git messages will be in English as some errors are handled by analysing the message content

const fs = fsApi.promises;

export default class Git {
  constructor({ path: repositoryPath, author }) {
    this.path = repositoryPath;
    this.author = author;
  }

  async initialize() {
    if (!fsApi.existsSync(this.path)) {
      await fs.mkdir(this.path, { recursive: true });
    }

    this.git = simpleGit(this.path, { maxConcurrentProcesses: 1 });
    await this.git.init();

    return this.git
      .addConfig('core.autocrlf', false)
      .addConfig('push.default', 'current')
      .addConfig('user.name', this.author.name)
      .addConfig('user.email', this.author.email);
  }

  async add(filepath) {
    return this.git.add(this.relativePath(filepath));
  }

  async commit(filepath, message, date) {
    if (date) {
      const commitDate = new Date(date).toISOString();

      process.env.GIT_AUTHOR_DATE = commitDate;
      process.env.GIT_COMMITTER_DATE = commitDate;
    }

    let summary;

    try {
      if (filepath) {
        summary = await this.git.commit(message, filepath);
      } else {
        summary = await this.git.commit(message);
      }
    } finally {
      process.env.GIT_AUTHOR_DATE = '';
      process.env.GIT_COMMITTER_DATE = '';
    }

    if (!summary.commit) { // Nothing committed, no hash to return
      return;
    }

    const shortHash = summary.commit.replace('HEAD ', '').replace('(root-commit) ', '');
    const longHash = (await this.git.show([ shortHash, '--pretty=%H', '-s' ])).trim();

    return longHash; // Return a long commit hash to always handle ids in the same format and facilitate comparison
  }

  async pushChanges() {
    return this.git.push();
  }

  async log(options = {}) {
    try {
      options.file = options.file && this.relativePath(options.file);
      const logSummary = await this.git.log(options);

      return logSummary.all;
    } catch (error) {
      if (
        !(
          error.message.includes('unknown revision or path not in the working tree')
          || error.message.includes('does not have any commits yet')
        )
      ) {
        throw error;
      }

      return [];
    }
  }

  async isTracked(filepath) {
    const result = await this.git.raw('ls-files', this.relativePath(filepath));

    return Boolean(result);
  }

  async checkout(options) {
    return this.git.checkout(options);
  }

  async raw(options) {
    return this.git.raw(options);
  }

  async show(options) {
    return this.git.show(options);
  }

  relativePath(absolutePath) {
    // Git needs a path relative to the .git directory, not an absolute one
    return path.relative(this.path, absolutePath);
  }
}
