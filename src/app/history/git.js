import path from 'path';
import config from 'config';

import simpleGit from 'simple-git';

process.env.LC_ALL = 'en_GB'; // Ensure git messages will be in English as some errors are handled by analysing the message content

export default class Git {
  constructor(repositoryPath) {
    this.path = repositoryPath;
    this.git = simpleGit(repositoryPath, { maxConcurrentProcesses: 1 });
  }

  async init() {
    return this.git.init();
  }

  async add(filepath) {
    return this.git.add(this.relativePath(filepath));
  }

  async commit(filepath, message) {
    const summary = await this.git.commit(message, this.relativePath(filepath), { '--author': `${config.get('history.author').name} <${config.get('history.author').email}>` });
    return summary.commit.replace('HEAD ', '').replace('(root-commit) ', '');
  }

  async pushChanges() {
    return this.git.push('origin', 'master');
  }

  async log(options = {}) {
    try {
      options.file = options.file && this.relativePath(options.file);
      const logSummary = await this.git.log(options);
      return logSummary.all;
    } catch (error) {
      if (!(error.message.includes('unknown revision or path not in the working tree')
         || error.message.includes('does not have any commits yet'))) {
        throw (error);
      }
      return [];
    }
  }

  async isTracked(filepath) {
    const result = await this.git.raw('ls-files', this.relativePath(filepath));
    return !!result;
  }

  async findUnique(glob) {
    const [ latestCommit ] = await this.log([ '-n', '1', '--stat=4096', glob ]);

    if (!latestCommit) {
      return {};
    }

    const filePaths = latestCommit.diff.files.map(file => file.file);

    if (filePaths.length > 1) {
      throw new Error(`Only one document should have been recorded in ${latestCommit.hash}, but all these documents were recorded: ${filePaths}`);
    }

    return {
      commit: latestCommit,
      filePath: filePaths[0],
    };
  }

  async checkout(options) {
    return this.git.checkout(options);
  }

  relativePath(absolutePath) {
    // Git needs a path relative to the .git directory, not an absolute one
    return path.relative(this.path, absolutePath);
  }
}
