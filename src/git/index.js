import { execFile } from 'child_process';
import fsApi from 'fs';
import path from 'path';

import simpleGit from 'simple-git';

import { GitObjectNotFoundError } from './errors.js';
import { parseTrailers, formatTrailers } from './trailers.js';
import { acquireWriterLock, WriterLockHeldError } from './writerLock.js';

export { GitObjectNotFoundError } from './errors.js';

process.env.LC_ALL = 'en_GB'; // Ensure git messages will be in English as some errors are handled by analysing the message content

const fs = fsApi.promises;

const WRITER_LOCK_FILE_NAME = 'ota-writer.lock';
const DEFAULT_BRANCH = 'main';
const READER_MAX_CONCURRENT_PROCESSES = 4; // Read-only commands write neither the index nor the commit-graph, so a reader can run several of them at once; the limit keeps a burst of API requests from taking all the CPU away from the tracker
const DIFF_STATS_BATCH_SIZE = 200; // Bounds the length of the command line, which is limited on some platforms
const COMMITS_BATCH_SIZE = 500; // Bounds the length of the command line, which is limited on some platforms
const COMMIT_HASH_REGEXP = /^[0-9a-f]{40}$/;

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

  static async listFilesAtCommit(repositoryPath, commit, { recursive = false } = {}) {
    const recursiveOption = recursive ? ['-r'] : []; // Lists the files of subdirectories instead of the subdirectories themselves
    const output = await readObjectAtCommit(repositoryPath, [ 'ls-tree', ...recursiveOption, '--name-only', commit, '--', './' ]); // `repositoryPath` may be a subdirectory of the repository; git resolves the `./` pathspec against its cwd.

    return output ? output.split('\n') : [];
  }

  static readFileAtCommit(repositoryPath, commit, fileName) { // Returns the content of `fileName` (relative to `repositoryPath`) at the given commit
    return readObjectAtCommit(repositoryPath, [ 'show', `${commit}:./${fileName}` ]); // The `rev:./path` syntax makes git resolve the path against its cwd, which supports repositoryPath being a subdirectory of the repository
  }

  static readFilesAtCommit(repositoryPath, commit, fileNames) { // Returns the contents of `fileNames` at the given commit, in the same order, with null for a file absent from the commit; a single git process reads them all, as spawning one per file does not scale to a whole collection
    return new Promise((resolve, reject) => {
      const gitProcess = execFile('git', [ 'cat-file', '--batch' ], { cwd: repositoryPath, encoding: 'buffer', maxBuffer: Infinity }, (error, output, errorOutput) => {
        if (error) {
          return reject(error);
        }

        const contents = parseBatchOutput(output);
        const errorMessages = errorOutput.toString();

        if (/^error:/m.test(errorMessages) && contents.includes(null)) { // Git reports an object it cannot read, such as a corrupt one, like an absent one, and only tells them apart by an error on its error output, where harmless warnings and hints may also appear
          return reject(new Error(errorMessages.trim()));
        }

        const [ commitContent, ...filesContents ] = contents;

        if (commitContent === null) {
          return reject(new GitObjectNotFoundError(`Unknown commit ${commit}`));
        }

        resolve(filesContents);
      });

      gitProcess.stdin.on('error', () => {}); // Git may exit before reading all the names, for example on a corrupt repository, which fails the pending write; the callback above already rejects with the actual cause, whereas an unhandled write error would crash the process
      gitProcess.stdin.end([ `${commit}^{commit}`, ...fileNames.map(fileName => `${commit}:./${fileName}`) ].map(objectName => `${objectName}\n`).join('')); // The commit itself is read first so that an unknown commit is not mistaken for absent files; one object name per line, as file names never contain a line feed: path segments with control characters are rejected before reaching the repositories
    });
  }

  static async getLatestCommit(repositoryPath, { grep, filePath }) { // Returns the hash and trailers of the newest commit touching `filePath` whose message matches the basic regular expression `grep`, whatever pattern type the git configuration of the operator sets; unlike listCommits, which orders commits by date and loads their files, this lets git stop at the first match instead of walking the whole history
    try {
      const output = await simpleGit(repositoryPath, { trimmed: true }).raw([ 'log', '--basic-regexp', '--max-count=1', '--format=%H%x00%B', `--grep=${grep}`, '--', filePath ]);

      if (!output) {
        return null;
      }

      const [ hash, message ] = output.split('\0');

      return { hash, trailers: parseTrailers(message) };
    } catch (error) {
      if (/does not have any commits yet/.test(error.message)) {
        return null; // An empty repository, such as one initialized by a tracker that has not recorded anything yet
      }

      throw error;
    }
  }

  constructor({ path: repositoryPath, author }) {
    this.path = repositoryPath;
    this.author = author;
  }

  async initialize() {
    if (!fsApi.existsSync(this.path)) {
      await fs.mkdir(this.path, { recursive: true }); // simple-git cannot be instantiated on a missing directory
    }

    this.#connect({ maxConcurrentProcesses: 1 }); // Concurrent runs on the same repository race the index and the commit-graph and can corrupt them
    await this.git.init([`--initial-branch=${DEFAULT_BRANCH}`]); // Otherwise the branch of a new repository would depend on the `init.defaultBranch` setting of the server, which is often `master`, whereas the published repositories and the deployment use `main`. Git ignores this option for an existing repository, which thus keeps its branch, as renaming it would diverge from its remote
    await this.#acquireWriterLock();

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

  async #acquireWriterLock() { // Held until the process exits, so that no other process writes to the repository meanwhile: concurrent writers race the working tree and the index, and the clean up of one discards the uncommitted changes of the other
    const lockFilePath = path.join(this.path, '.git', WRITER_LOCK_FILE_NAME);

    try {
      await acquireWriterLock(lockFilePath); // Acquired again silently by the same process, as repositories are initialized again at each tracking run
    } catch (error) {
      if (!(error instanceof WriterLockHeldError)) {
        throw error;
      }

      throw new Error(`Repository ${this.path} is already being written by the process ${error.holderPid}; stop it before starting another writer, such as the tracker or the technical upgrades, or remove ${lockFilePath} if that process is not an Open Terms Archive writer`);
    }
  }

  open() {
    if (!fsApi.existsSync(path.join(this.path, '.git'))) {
      throw new Error(`Repository ${this.path} does not exist, it has to be created by a writer such as the tracker first`); // Without this check, git would silently walk up to an enclosing repository, such as the collection one
    }

    this.#connect({ maxConcurrentProcesses: READER_MAX_CONCURRENT_PROCESSES, config: ['core.quotePath=false'] }); // Disable pathname quoting for the same reason Git.initialize sets it on managed repositories, as a repository opened for reading may not have been configured by a writer, such as a plain clone
  }

  #connect(options) {
    this.git = simpleGit(this.path, { trimmed: true, ...options });
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

      summary = await this.git.commit(finalMessage, filePath ? this.relativePath(filePath) : [], ['--no-verify']); // Skip pre-commit and commit-msg hooks, as commits are programmatically managed, to optimize performance. The pathspec must be expressed relative to the repository root; passing the absolute or process-cwd-relative path causes git to look for it under the repo's working directory, which fails when the repo's own path components appear in the resolved location. Without a file path, the whole index is committed
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

  showBuffer(options) {
    return this.git.showBuffer(options);
  }

  async cleanUp() {
    await fs.rm(path.join(this.path, '.git', 'index.lock'), { force: true }); // Remove a leftover index lock from a Git operation that was killed mid-write, which would otherwise make every subsequent reset, add and commit fail. Safe as the writer lock guarantees that no other process writes to the repository, and readers never lock the index
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

  async listPathRevisions(pathspec) {
    let output;

    try {
      // Ordering and filtering are done by the caller in memory, so `--author-date-order` and `--grep` are deliberately omitted to keep this walk lean
      output = await this.git.raw([
        'log',
        '--no-merges',
        '-z', // Print file names verbatim and NUL-terminated, whatever characters they hold
        '--name-only', // List the files changed by each commit under the pathspec, to tell apart the terms of a service in memory
        '--format=%x00%H%x09%at%x09%ct%x09%B', // Tab-separated hash, author date, committer date and message; the leading NUL sets each commit apart from the NUL-terminated names of the files changed by the previous one
        '--', // Everything after is a pathspec, never a revision or an option
        pathspec,
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

    return output.replace(/^\0|\0$/g, '').split('\0\0').map(commitOutput => {
      const [ header, ...filePaths ] = commitOutput.split('\0');
      const [ hash, timestamp, commitTimestamp, ...messageParts ] = header.split('\t');

      return {
        hash,
        timestamp: parseInt(timestamp, 10),
        commitTimestamp: parseInt(commitTimestamp, 10),
        message: messageParts.join('\t').trimEnd(),
        filePaths: filePaths.map(filePath => filePath.replace(/^\n/, '')), // Git separates the names of the changed files from the commit header with a line feed
      };
    });
  }

  async countCommits(options) {
    try {
      return Number(await this.git.raw([ 'rev-list', '--count', '--no-merges', ...options ])); // Counted by git rather than by listing every commit to count them in memory, which takes seconds on large histories
    } catch (error) {
      if (/unknown revision or path not in the working tree|does not have any commits yet|bad revision 'HEAD'/.test(error.message)) {
        return 0;
      }

      throw error;
    }
  }

  async getCommitsByHashes(commitHashes, filePaths) {
    const literalPathspecs = filePaths.map(filePath => `:(literal)${filePath}`);
    const batches = await Promise.all(splitIntoBatches(commitHashes, COMMITS_BATCH_SIZE).map(batch => this.listCommits([
      '--no-walk=unsorted', // Show only the given commits, in the given order
      '--end-of-options', // Everything after is a revision or a pathspec, never an option
      ...batch,
      '--', // Everything after is a pathspec, never a revision
      ...literalPathspecs, // Only list the given files among the changed ones, as a record is read from a single file even when its commit also changed others
    ], { reverse: false })));

    return batches.flat();
  }

  async getDiffStats(commitHash) {
    const [stats] = (await this.getDiffStatsBatch([commitHash])).values(); // Taken as the only entry rather than by key, as git prints the full hash of an abbreviated one

    return stats;
  }

  async getDiffStatsBatch(commitHashes) {
    const outputs = await Promise.all(splitIntoBatches(commitHashes, DIFF_STATS_BATCH_SIZE).map(batch => this.git.raw([
      'show',
      '--numstat', // Report added/deleted line counts per file as tab-separated numbers, instead of a textual diff
      '--format=%H', // Print the hash of each commit before its numstat lines, to tell which commit they belong to
      '--end-of-options', // Everything after is a revision, never an option
      ...batch,
    ])));

    return new Map(outputs.flatMap(parseNumstatOutput));
  }
}

function splitIntoBatches(items, batchSize) {
  const batches = [];

  for (let start = 0; start < items.length; start += batchSize) {
    batches.push(items.slice(start, start + batchSize));
  }

  return batches;
}

function parseNumstatOutput(output) {
  const entries = [];

  for (const line of output.split('\n')) {
    if (COMMIT_HASH_REGEXP.test(line)) {
      entries.push([ line, { additions: 0, deletions: 0 }]);
      continue;
    }

    if (!line) {
      continue;
    }

    const [ added, deleted ] = line.split('\t');
    const [ , stats ] = entries.at(-1);

    // Binary files show '-' for additions/deletions
    if (added !== '-') {
      stats.additions += parseInt(added, 10);
    }
    if (deleted !== '-') {
      stats.deletions += parseInt(deleted, 10);
    }
  }

  return entries;
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

function parseBatchOutput(output) { // Each object is printed as a "<sha> <type> <size>" header line followed by its content and a line feed, and each unresolvable name as a "<name> missing" line
  const contents = [];
  let position = 0;

  while (position < output.length) {
    const headerEnd = output.indexOf('\n', position);
    const header = output.toString('utf8', position, headerEnd);

    position = headerEnd + 1;

    if (header.endsWith(' missing')) {
      contents.push(null);
      continue;
    }

    const size = Number(header.split(' ').pop());

    contents.push(output.toString('utf8', position, position + size));
    position += size + 1;
  }

  return contents;
}
