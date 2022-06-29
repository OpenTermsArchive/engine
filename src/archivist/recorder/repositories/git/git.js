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

  async add(filePath) {
    return this.git.add(this.relativePath(filePath));
  }

  async commit({ filePath, message, date = new Date() }) {
    const commitDate = new Date(date).toISOString();
    let summary;

    try {
      process.env.GIT_AUTHOR_DATE = commitDate;
      process.env.GIT_COMMITTER_DATE = commitDate;

      summary = await this.git.commit(message, filePath);
    } finally {
      process.env.GIT_AUTHOR_DATE = '';
      process.env.GIT_COMMITTER_DATE = '';
    }

    if (!summary.commit) { // Nothing committed, no hash to return
      return;
    }

    return summary.commit;
  }

  async pushChanges() {
    return this.git.push();
  }

  async listCommits(options = []) {
    return this.log([ '--reverse', '--no-merges', '--name-only', ...options ]);
  }

  async getCommit(options) {
    const [commit] = await this.listCommits([ '-1', ...options ]);

    return commit;
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

  async isTracked(filePath) {
    const result = await this.git.raw('ls-files', this.relativePath(filePath));

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

  async clear() {
    await this.git.reset('hard');

    return this.git.clean('f', '-d');
  }

  async getFullHash(shortHash) {
    return (await this.git.show([ shortHash, '--pretty=%H', '-s' ])).trim();
  }

  async restore(path, commit) {
    return this.git.raw([ 'restore', '-s', commit, '--', path ]);
  }

  async cleanUp() {
    await this.git.raw([ 'update-ref', '-d', 'HEAD' ]);

    return this.clear();
  }

  relativePath(absolutePath) {
    // Git needs a path relative to the .git directory, not an absolute one
    return path.relative(this.path, absolutePath);
  }
}
