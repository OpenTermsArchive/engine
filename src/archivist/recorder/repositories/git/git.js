import fsApi from 'fs';
import path from 'path';

import simpleGit from 'simple-git';

import { parseTrailers, formatTrailers } from './trailers.js';

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

    this.git = simpleGit(this.path, {
      trimmed: true,
      maxConcurrentProcesses: 1,
    });

    await this.git.init();

    return this.git
      .addConfig('core.autocrlf', false)
      .addConfig('push.default', 'current')
      .addConfig('user.name', this.author.name)
      .addConfig('user.email', this.author.email)
      .addConfig('core.quotePath', false) // Disable Git's encoding of special characters in pathnames. For example, `service·A` will be encoded as `service\302\267A` without this setting, leading to issues. See https://git-scm.com/docs/git-config#Documentation/git-config.txt-corequotePath
      .addConfig('core.commitGraph', true) // Enable `commit-graph` feature for efficient commit data storage, improving performance of operations like `git log`
      .addConfig('gc.writeCommitGraph', false); // Prevent automatic `git gc` from also writing the commit-graph: the engine writes it explicitly (see `writeCommitGraph`/`updateCommitGraph`), and a concurrent gc write races those, which can leave a stale `commit-graph.lock` and make subsequent operations fail
  }

  add(filePath) {
    return this.git.add(this.relativePath(filePath));
  }

  async commit({ filePath, message, date = new Date(), trailers = {} }) {
    const commitDate = new Date(date).toISOString();
    let summary;

    try {
      process.env.GIT_AUTHOR_DATE = commitDate;
      process.env.GIT_COMMITTER_DATE = commitDate;

      const trailersSection = formatTrailers(trailers);
      const finalMessage = trailersSection ? `${message}\n\n${trailersSection}` : message;

      summary = await this.git.commit(finalMessage, filePath, ['--no-verify']); // Skip pre-commit and commit-msg hooks, as commits are programmatically managed, to optimize performance
    } finally {
      process.env.GIT_AUTHOR_DATE = '';
      process.env.GIT_COMMITTER_DATE = '';
    }

    if (!summary.commit) { // Nothing committed, no hash to return
      return;
    }

    return summary.commit;
  }

  pushChanges() {
    return this.git.push();
  }

  listCommits(options = [], { reverse = true, skip, maxCount } = {}) {
    const reverseOption = reverse ? ['--reverse'] : [];
    const skipOption = skip !== undefined ? [`--skip=${skip}`] : [];
    const maxCountOption = maxCount !== undefined ? [`--max-count=${maxCount}`] : [];

    return this.log([
      ...reverseOption, // When `reverse` is true, lists commits oldest-first; otherwise the default newest-first applies
      '--author-date-order', // Best-effort author-date ordering: with --max-count, git applies the cap topologically, so the page can miss strictly-newer commits that #getCommits' JS resort cannot recover
      '--no-merges', // Exclude merge commits — records are stored as regular commits, never as merges
      '--name-only', // Append the modified file names below each commit, used by `toDomain` to extract the record's file path
      ...skipOption, // Optional `--skip=N`: drop the first N matching commits (pagination offset)
      ...maxCountOption, // Optional `--max-count=N`: cap the result to N commits (pagination limit)
      ...options, // Caller-supplied options: typically grep filters on commit messages and a path filter (`-- pathspec`)
    ]);
  }

  async getCommit(options) {
    const [commit] = await this.listCommits([ '-1', ...options ]); // Returns only the most recent commit matching the given options

    if (commit) {
      commit.trailers = parseTrailers(commit.body);
    }

    return commit;
  }

  async log(options = []) {
    try {
      const logSummary = await this.git.log(options);
      const commits = logSummary.all;

      commits.forEach(commit => {
        commit.trailers = parseTrailers(commit.body);
      });

      return commits;
    } catch (error) {
      if (/unknown revision or path not in the working tree|does not have any commits yet/.test(error.message)) {
        return [];
      }

      throw error;
    }
  }

  async isTracked(filePath) {
    const result = await this.git.raw('ls-files', this.relativePath(filePath));

    return Boolean(result);
  }

  checkout(options) {
    return this.git.checkout(options);
  }

  show(options) {
    return this.git.show(options);
  }

  async cleanUp() {
    await fs.rm(path.join(this.path, '.git', 'objects', 'info', 'commit-graph.lock'), { force: true }); // Remove a leftover commit-graph lock from a previous `commit-graph write` that was killed mid-write (e.g. the process was terminated during a deploy or restart). The commit-graph is a disposable cache rebuilt by `writeCommitGraph`, so clearing a stale lock is safe and prevents every subsequent run from failing.
    await this.git.reset('hard');

    return this.git.clean('f', '-d');
  }

  getFullHash(shortHash) {
    return this.git.show([ shortHash, '--pretty=%H', '-s' ]);
  }

  restore(path, commit) {
    return this.git.raw([ 'restore', '-s', commit, '--', path ]);
  }

  async destroyHistory() {
    await fs.rm(this.path, { recursive: true });

    return this.initialize();
  }

  relativePath(absolutePath) {
    return path.relative(this.path, absolutePath); // Git needs a path relative to the .git directory, not an absolute one
  }

  async listFiles(path) {
    return (await this.git.raw([ 'ls-files', path ])).split('\n');
  }

  async writeCommitGraph() {
    await this.git.raw([ 'commit-graph', 'write', '--reachable', '--changed-paths' ]);
  }

  async updateCommitGraph() {
    await this.git.raw([ 'commit-graph', 'write', '--reachable', '--changed-paths', '--append' ]);
  }
}
