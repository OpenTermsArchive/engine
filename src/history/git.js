import path from 'path';
import config from 'config';

import simpleGit from 'simple-git';

export default class Git {
  constructor(repositoryPath) {
    this.path = repositoryPath;
    this.git = simpleGit(repositoryPath);
  }

  async init() {
    return this.git.init();
  }

  async add(filepath) {
    return this.git.add(this.relativePath(filepath));
  }

  async status() {
    return this.git.status();
  }

  async commit(filepath, message) {
    const summary = await this.git.commit(message, this.relativePath(filepath), { '--author': `${config.get('history.author').name} <${config.get('history.author').email}>` });
    return summary.commit.replace('HEAD ', '');
  }

  async pushChanges() {
    return this.git.push('origin', 'master');
  }

  async hasChanges(filepath) {
    const status = await this.git.status();
    const relativePath = this.relativePath(filepath);
    const escapedRelativePath = filepath.includes(' ') ? `"${relativePath}"` : relativePath;
    return (status.modified.indexOf(escapedRelativePath) > -1)
           || (status.not_added.indexOf(relativePath) > -1)
           || (status.created.indexOf(relativePath) > -1);
  }

  async isNew(filepath) {
    const status = await this.git.status();
    return (status.created.indexOf(this.relativePath(filepath)) > -1)
           || (status.not_added.indexOf(this.relativePath(filepath)) > -1);
  }

  async log(options) {
    return this.git.log(options);
  }

  relativePath(absolutePath) {
    // Git needs a path relative to the .git directory, not an absolute one
    return path.relative(this.path, absolutePath);
  }
}
