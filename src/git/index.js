import fsApi from 'fs';
import path from 'path';

import simpleGit from 'simple-git';

import { GitObjectNotFoundError } from './errors.js';
import { parseTrailers, formatTrailers } from './trailers.js';

export { GitObjectNotFoundError } from './errors.js';

process.env.LC_ALL = 'en_GB'; // Ensure git messages will be in English as some errors are handled by analysing the message content

const fs = fsApi.promises;

const OBJECT_NOT_FOUND_MESSAGES = /bad object|not a tree|invalid object name|unknown revision|does not exist|exists on disk, but not in/i;

export default class Git {
  static async getHeadSha(repositoryPath) { // Used by callers that need to capture the current state of a repository without instantiating a full Git wrapper (which would mutate the repo via `init`).
    try {
      const git = simpleGit(repositoryPath, { trimmed: true });

      return await git.revparse(['HEAD']);
    } catch (error) {
      if (/not a git repository|does not exist|unknown revision|ambiguous argument|does not have any commits/i.test(error.message)) {
        return null; // Not a repository, or an empty one: a legitimate "no commit to reference" answer
      }

      throw error; // An actual git failure, which callers must not conflate with the absence of a repository
    }
  }

  static async listFilesAtCommit(repositoryPath, commit) {
    const output = await readObjectAtCommit(repositoryPath, [ 'ls-tree', '--name-only', commit, '--', './' ]); // `repositoryPath` may be a subdirectory of the repository; git resolves the `./` pathspec against its cwd.

    return output ? output.split('\n') : [];
  }

  // Read-only helper: returns the content of `fileName` (relative to `repositoryPath`) at the given commit.
  static readFileAtCommit(repositoryPath, commit, fileName) {
    return readObjectAtCommit(repositoryPath, [ 'show', `${commit}:./${fileName}` ]); // The `rev:./path` syntax makes git resolve the path against its cwd, which supports repositoryPath being a subdirectory of the repository
  }

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
      maxConcurrentProcesses: 1, // Concurrent runs on the same repository race the index and the commit-graph and can corrupt them
    });

    await this.git.init();

    const configFile = path.resolve(this.path, '.git', 'config'); // Anchored to an absolute path: git resolves a relative `--file` argument against its own cwd (the repository), not against process.cwd, so a relative repository path would silently point the write at a nonexistent nested location

    if (!fsApi.existsSync(configFile)) { // Defensive: init should always produce this file; if it does not, refuse to continue rather than risk writing config to an unintended location
      throw new Error(`Git initialisation failed: expected config file at ${configFile} was not created`);
    }

    // Each setting is written to the explicit config file path rather than via `addConfig` so neither simpleGit nor git itself can walk up to a parent .git and pollute the configuration of an enclosing project (e.g. the engine's own checkout when this.path is `./data/versions`).
    return this.git
      .raw([ 'config', '--file', configFile, 'core.autocrlf', 'false' ])
      .raw([ 'config', '--file', configFile, 'push.default', 'current' ])
      .raw([ 'config', '--file', configFile, 'user.name', this.author.name ])
      .raw([ 'config', '--file', configFile, 'user.email', this.author.email ])
      .raw([ 'config', '--file', configFile, 'core.quotePath', 'false' ]) // Disable Git's encoding of special characters in pathnames. For example, `service·A` will be encoded as `service\302\267A` without this setting, leading to issues. See https://git-scm.com/docs/git-config#Documentation/git-config.txt-corequotePath
      .raw([ 'config', '--file', configFile, 'core.commitGraph', 'true' ]) // Enable `commit-graph` feature for efficient commit data storage, improving performance of operations like `git log`
      .raw([ 'config', '--file', configFile, 'gc.writeCommitGraph', 'false' ]); // Prevent automatic `git gc` from also writing the commit-graph: the engine writes it explicitly (see `writeCommitGraph`/`updateCommitGraph`), and a concurrent gc write races those, which can leave a stale `commit-graph.lock` and make subsequent operations fail
  }

  add(filePath) {
    return this.git.add(this.relativePath(filePath));
  }

  // Not safe to call concurrently: GIT_AUTHOR_DATE / GIT_COMMITTER_DATE are process-wide env vars, so two overlapping calls can stamp each other's commits.
  // simple-git's `maxConcurrentProcesses: 1` serializes child processes but not the env-var mutation that precedes them. Callers must await each commit before issuing the next.
  async commit({ filePath, message, date = new Date(), trailers = {} }) {
    const commitDate = new Date(date).toISOString();
    let summary;

    try {
      process.env.GIT_AUTHOR_DATE = commitDate;
      process.env.GIT_COMMITTER_DATE = commitDate;

      const trailersSection = formatTrailers(trailers);
      const finalMessage = trailersSection ? `${message}\n\n${trailersSection}` : message;

      summary = await this.git.commit(finalMessage, this.relativePath(filePath), ['--no-verify']); // Skip pre-commit and commit-msg hooks, as commits are programmatically managed, to optimize performance. The pathspec must be expressed relative to the repository root; passing the absolute or process-cwd-relative path causes git to look for it under the repo's working directory, which fails when the repo's own path components appear in the resolved location
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
      '--no-merges', // Exclude merge commits; records are stored as regular commits, never as merges
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
      // `bad object` is raised for a well-formed but absent object ID; like an unknown revision, it means "no match" rather than a hard failure
      if (/unknown revision or path not in the working tree|does not have any commits yet|bad object/.test(error.message)) {
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

    return this.git.clean('f', '-d'); // Force-remove untracked files (`f`) and untracked directories (`-d`)
  }

  getFullHash(shortHash) {
    return this.git.show([
      shortHash,
      '--pretty=%H', // Print the full 40-character commit hash
      '-s', // Suppress the diff output, only the formatted hash is wanted
    ]);
  }

  restore(path, commit) {
    return this.git.raw([
      'restore',
      '-s', commit, // Take the file contents from this specific commit rather than from the index
      '--', // Everything after is a pathspec, not a revision or option
      path,
    ]);
  }

  async destroyHistory() {
    await fs.rm(this.path, { recursive: true });

    return this.initialize();
  }

  relativePath(absolutePath) {
    return path.relative(this.path, absolutePath); // Git needs a path relative to the .git directory, not an absolute one
  }

  async listFiles(path) {
    return (await this.git.raw([ 'ls-files', '--', path ])).split('\n'); // Everything after "--" is a pathspec, not a revision or option
  }

  async writeCommitGraph() {
    await this.git.raw([
      'commit-graph',
      'write',
      '--reachable', // Cover every commit reachable from the refs, so the whole history is indexed
      '--changed-paths', // Also store the changed-path Bloom filters that speed up path-limited log/diff
    ]);
  }

  async updateCommitGraph() {
    await this.git.raw([
      'commit-graph',
      'write',
      '--reachable',
      '--changed-paths',
      '--append', // Extend the existing commit-graph instead of rewriting it in full
    ]);
  }

  async listPathRevisions(pathFilter) {
    let output;

    try {
      // Ordering and technical-upgrade filtering are done by the caller in memory, so `--author-date-order`/`--grep`/`--name-only` are deliberately omitted to keep this walk lean
      output = await this.git.raw([
        'log',
        '--no-merges',
        '--format=%H%x09%at%x09%s', // Tab-separated hash, author date and subject: the minimum needed to order versions and detect technical upgrades, with no diff or message body loaded
        '--', // Everything after is a pathspec, never a revision or an option
        pathFilter,
      ]);
    } catch (error) {
      if (/unknown revision or path not in the working tree|does not have any commits yet/.test(error.message)) {
        return [];
      }

      throw error;
    }

    if (!output) {
      return [];
    }

    return output.trim().split('\n').filter(Boolean).map(line => {
      const [ hash, timestamp, ...subjectParts ] = line.split('\t');

      return { hash, timestamp: parseInt(timestamp, 10), subject: subjectParts.join('\t') };
    });
  }

  async getDiffStats(commitHash) {
    const output = await this.git.raw([
      'show',
      '--numstat', // Report added/deleted line counts per file as tab-separated numbers, instead of a textual diff
      '--format=', // Drop the commit header so the output holds only the numstat lines
      commitHash,
    ]);

    let additions = 0;
    let deletions = 0;

    for (const line of output.trim().split('\n')) {
      if (!line) {
        continue;
      }

      const [ added, deleted ] = line.split('\t');

      // Binary files show '-' for additions/deletions
      if (added !== '-') {
        additions += parseInt(added, 10);
      }
      if (deleted !== '-') {
        deletions += parseInt(deleted, 10);
      }
    }

    return { additions, deletions };
  }
}

async function readObjectAtCommit(repositoryPath, args) {
  try {
    return await simpleGit(repositoryPath, { trimmed: true, config: ['core.quotePath=false'] }).raw(args); // Disable pathname quoting for the same reason Git.initialize sets it on managed repositories: names with special characters (e.g. "service·A") must come back verbatim, and this repository's configuration is not under the engine's control
  } catch (error) {
    if (OBJECT_NOT_FOUND_MESSAGES.test(error.message)) {
      throw new GitObjectNotFoundError(error.message); // Typed so callers can distinguish "this commit or file cannot be resolved, ever" from a transient git failure worth retrying
    }

    throw error;
  }
}
