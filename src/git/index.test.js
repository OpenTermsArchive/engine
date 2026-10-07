import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import simpleGit from 'simple-git';

import Git, { GitObjectNotFoundError } from './index.js';

use(chaiAsPromised);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECORDER_PATH = path.resolve(__dirname, '../../', config.get('@opentermsarchive/engine.recorder.versions.storage.git.path'));

describe('Git', () => {
  const DEFAULT_CONTENT = 'default content';
  const DEFAULT_COMMIT_MESSAGE = 'default commit message';
  let subject;

  before(() => {
    subject = new Git({
      path: RECORDER_PATH,
      author: {
        name: config.get('@opentermsarchive/engine.recorder.versions.storage.git.author.name'),
        email: config.get('@opentermsarchive/engine.recorder.versions.storage.git.author.email'),
      },
    });

    return subject.initialize();
  });

  describe('#initialize', () => {
    const AUTHOR = { name: 'Writer lock tester', email: 'writer-lock@example.com' };
    let repositoryPath;
    let lockFilePath;

    beforeEach(async () => {
      repositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), 'ota-writer-lock-'));
      lockFilePath = path.join(repositoryPath, '.git', 'ota-writer.lock');
    });

    afterEach(() => fs.rm(repositoryPath, { recursive: true, force: true }));

    it('locks the repository with the PID of the current process', async () => {
      await new Git({ path: repositoryPath, author: AUTHOR }).initialize();

      expect(await fs.readFile(lockFilePath, 'utf8')).to.equal(String(process.pid));
    });

    it('can be initialized again by the same process', async () => {
      await new Git({ path: repositoryPath, author: AUTHOR }).initialize();

      await expect(new Git({ path: repositoryPath, author: AUTHOR }).initialize()).to.be.fulfilled;
    });

    context('when the repository does not exist', () => {
      const GIT_CONFIG_ENVIRONMENT = { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'init.defaultBranch', GIT_CONFIG_VALUE_0: 'master' };

      beforeEach(() => Object.assign(process.env, GIT_CONFIG_ENVIRONMENT));

      afterEach(() => Object.keys(GIT_CONFIG_ENVIRONMENT).forEach(name => delete process.env[name]));

      it('creates it on the main branch, whatever the Git default initial branch', async () => {
        await new Git({ path: repositoryPath, author: AUTHOR }).initialize();

        expect(await runGit(repositoryPath, [ 'symbolic-ref', '--short', 'HEAD' ])).to.equal('main');
      });

      context('when a previous initialization was interrupted', () => {
        beforeEach(() => fs.mkdir(path.join(repositoryPath, '.git')));

        it('creates it on the main branch', async () => {
          await new Git({ path: repositoryPath, author: AUTHOR }).initialize();

          expect(await runGit(repositoryPath, [ 'symbolic-ref', '--short', 'HEAD' ])).to.equal('main');
        });
      });
    });

    context('when the repository already exists on another branch', () => {
      beforeEach(async () => {
        await runGit(repositoryPath, [ '-c', 'init.defaultBranch=master', 'init' ]);
        await runGit(repositoryPath, [ '-c', `user.name=${AUTHOR.name}`, '-c', `user.email=${AUTHOR.email}`, 'commit', '--allow-empty', '--message=Initial commit' ]);
      });

      it('keeps its branch', async () => {
        await new Git({ path: repositoryPath, author: AUTHOR }).initialize();

        expect(await runGit(repositoryPath, [ 'symbolic-ref', '--short', 'HEAD' ])).to.equal('master');
      });
    });

    context('when another running process holds the lock', () => {
      let otherProcess;

      beforeEach(async () => {
        otherProcess = spawn(process.execPath, [ '-e', 'setInterval(() => {}, 1000)' ]);
        await fs.mkdir(path.dirname(lockFilePath), { recursive: true });
        await fs.writeFile(lockFilePath, String(otherProcess.pid));
      });

      afterEach(() => otherProcess.kill());

      it('rejects with an error naming the holder', async () => {
        await expect(new Git({ path: repositoryPath, author: AUTHOR }).initialize()).to.be.rejectedWith(`already being written by the process ${otherProcess.pid}`);
      });

      it('names the lock file in the error', async () => {
        await expect(new Git({ path: repositoryPath, author: AUTHOR }).initialize()).to.be.rejectedWith(lockFilePath);
      });
    });
  });

  describe('#commit', () => {
    const expectedFilePath = `${RECORDER_PATH}/test.md`;

    let commitId;

    before(async () => {
      await fs.writeFile(expectedFilePath, DEFAULT_CONTENT);

      await subject.add(expectedFilePath);
      commitId = await subject.commit({ filePath: expectedFilePath, message: DEFAULT_COMMIT_MESSAGE });
    });

    after(() => subject.destroyHistory());

    it('returns a full length SHA1 commit ID', () => {
      expect(commitId).to.match(/\b[0-9a-f]{40}\b/);
    });

    context('when stage area is dirty', () => {
      const expectedFileName = 'file-to-commit.md';
      const expectedFilePath = `${RECORDER_PATH}/${expectedFileName}`;
      const unwantedFilePath = `${RECORDER_PATH}/unwanted-file.md`;
      let commit;
      let committedFiles;
      let committedFileName;

      before(async () => {
        await fs.writeFile(expectedFilePath, DEFAULT_CONTENT);
        await fs.writeFile(unwantedFilePath, DEFAULT_CONTENT);

        await subject.add(expectedFilePath);
        await subject.add(unwantedFilePath);

        const commitId = await subject.commit({ filePath: expectedFilePath, message: DEFAULT_COMMIT_MESSAGE });

        commit = await subject.getCommit([commitId]);

        if (!commit) {
          return;
        }

        ({ files: committedFiles } = commit.diff);
        ([{ file: committedFileName }] = committedFiles);
      });

      after(() => subject.destroyHistory());

      it('commits the specified file', () => {
        expect(committedFileName).to.equal(expectedFileName);
      });

      it('commits only one file', () => {
        expect(committedFiles).to.have.lengthOf(1);
      });
    });

    context('when no file path is given', () => {
      const stagedFileNames = [ 'first-staged-file.md', 'second-staged-file.md' ];
      let committedFileNames;

      before(async () => {
        for (const fileName of stagedFileNames) {
          const filePath = `${RECORDER_PATH}/${fileName}`;

          await fs.writeFile(filePath, DEFAULT_CONTENT);
          await subject.add(filePath);
        }

        const commitId = await subject.commit({ message: DEFAULT_COMMIT_MESSAGE });
        const commit = await subject.getCommit([commitId]);

        committedFileNames = commit.diff.files.map(({ file }) => file);
      });

      after(() => subject.destroyHistory());

      it('commits all the staged files', () => {
        expect(committedFileNames).to.have.members(stagedFileNames);
      });
    });
  });

  describe('#cleanUp', () => {
    context('when a commit-graph lock has been left behind by an interrupted process', () => {
      const infoDirectoryPath = path.join(RECORDER_PATH, '.git', 'objects', 'info');
      const lockFilePath = path.join(infoDirectoryPath, 'commit-graph.lock');

      before(async () => {
        const filePath = `${RECORDER_PATH}/file-to-clean.md`;

        await fs.writeFile(filePath, DEFAULT_CONTENT);
        await subject.add(filePath);
        await subject.commit({ filePath, message: DEFAULT_COMMIT_MESSAGE });

        await fs.mkdir(infoDirectoryPath, { recursive: true });
        await fs.writeFile(lockFilePath, '');

        await subject.cleanUp();
      });

      after(() => subject.destroyHistory());

      it('removes the stale commit-graph lock', async () => {
        const infoDirectoryContent = await fs.readdir(infoDirectoryPath);

        expect(infoDirectoryContent).to.not.include('commit-graph.lock');
      });
    });
    context('when an index lock has been left behind by an interrupted process', () => {
      const indexLockFilePath = path.join(RECORDER_PATH, '.git', 'index.lock');

      before(async () => {
        const filePath = `${RECORDER_PATH}/file-to-clean.md`;

        await fs.writeFile(filePath, DEFAULT_CONTENT);
        await subject.add(filePath);
        await subject.commit({ filePath, message: DEFAULT_COMMIT_MESSAGE });

        await fs.writeFile(indexLockFilePath, '');

        await subject.cleanUp();
      });

      after(() => subject.destroyHistory());

      it('removes the stale index lock', async () => {
        await expect(fs.access(indexLockFilePath)).to.be.rejected;
      });

      it('leaves the repository writable', async () => {
        const filePath = `${RECORDER_PATH}/file-after-clean.md`;

        await fs.writeFile(filePath, DEFAULT_CONTENT);
        await subject.add(filePath);

        expect(await subject.commit({ filePath, message: DEFAULT_COMMIT_MESSAGE })).to.be.a('string');
      });
    });
  });

  describe('.getHeadSha', () => {
    context('with a directory that does not exist', () => {
      it('returns null', async () => {
        expect(await Git.getHeadSha(path.join(os.tmpdir(), 'ota-nonexistent-directory'))).to.be.null;
      });
    });

    context('with a directory that is not inside a Git repository', () => {
      let directory;

      before(async () => {
        directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ota-git-test-')); // Under the OS temp directory, so no enclosing Git repository can be found by walking up
      });

      after(() => fs.rm(directory, { recursive: true, force: true }));

      it('returns null', async () => {
        expect(await Git.getHeadSha(directory)).to.be.null;
      });
    });

    context('with a repository that has no commits yet', () => {
      let directory;

      before(async () => {
        directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ota-git-test-'));
        await new Git({ path: directory, author: { name: 'Test', email: 'test@example.com' } }).initialize();
      });

      after(() => fs.rm(directory, { recursive: true, force: true }));

      it('returns null', async () => {
        expect(await Git.getHeadSha(directory)).to.be.null;
      });
    });

    context('with a repository that has commits', () => {
      let commitId;

      before(async () => {
        const filePath = `${RECORDER_PATH}/test.md`;

        await fs.writeFile(filePath, DEFAULT_CONTENT);
        await subject.add(filePath);
        commitId = await subject.commit({ filePath, message: DEFAULT_COMMIT_MESSAGE });
      });

      after(() => subject.destroyHistory());

      it('returns the SHA of HEAD', async () => {
        expect(await Git.getHeadSha(RECORDER_PATH)).to.equal(commitId);
      });
    });
  });

  describe('reading at a specific commit', () => {
    let repositoryPath;
    let subdirectoryPath;
    let firstCommitSha;
    let secondCommitSha;

    before(async () => {
      repositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), 'ota-git-test-')); // Under the OS temp directory so the fixture repository is not nested in the engine's own repository
      subdirectoryPath = path.join(repositoryPath, 'declarations');
      await fs.mkdir(subdirectoryPath);

      const git = new Git({ path: repositoryPath, author: { name: 'Test', email: 'test@example.com' } });

      await git.initialize();

      const firstFilePath = path.join(subdirectoryPath, 'Service A.json');

      await fs.writeFile(firstFilePath, '{ "name": "Service A" }');
      await git.add(firstFilePath);
      firstCommitSha = await git.commit({ filePath: firstFilePath, message: 'Add Service A' });

      const secondFilePath = path.join(subdirectoryPath, 'Service B.json');

      await fs.writeFile(secondFilePath, '{ "name": "Service B" }');
      await git.add(secondFilePath);
      secondCommitSha = await git.commit({ filePath: secondFilePath, message: 'Add Service B' });
    });

    after(() => fs.rm(repositoryPath, { recursive: true, force: true }));

    describe('.listFilesAtCommit', () => {
      it('lists the files of the subdirectory as they were at the given commit', async () => {
        expect(await Git.listFilesAtCommit(subdirectoryPath, firstCommitSha)).to.deep.equal(['Service A.json']);
      });

      it('reflects later commits when given their SHA', async () => {
        expect(await Git.listFilesAtCommit(subdirectoryPath, secondCommitSha)).to.deep.equal([ 'Service A.json', 'Service B.json' ]);
      });

      context('when listing recursively', () => {
        it('lists the files of the subdirectories', async () => {
          expect(await Git.listFilesAtCommit(repositoryPath, secondCommitSha, { recursive: true })).to.deep.equal([ 'declarations/Service A.json', 'declarations/Service B.json' ]);
        });
      });

      it('throws a GitObjectNotFoundError for an unknown commit', async () => {
        try {
          await Git.listFilesAtCommit(subdirectoryPath, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
        } catch (error) {
          expect(error).to.be.an.instanceOf(GitObjectNotFoundError);

          return;
        }

        expect.fail('No error was thrown');
      });
    });

    describe('.getLatestCommitSha', () => {
      it('returns the newest commit touching the file whose message matches', async () => {
        expect(await Git.getLatestCommitSha(repositoryPath, { grep: '^Add Service [AB]$', filePath: 'declarations' })).to.equal(secondCommitSha);
      });

      it('ignores newer commits whose message does not match', async () => {
        expect(await Git.getLatestCommitSha(repositoryPath, { grep: '^Add Service A$', filePath: 'declarations' })).to.equal(firstCommitSha);
      });

      it('returns null when no commit matches', async () => {
        expect(await Git.getLatestCommitSha(repositoryPath, { grep: '^Remove', filePath: 'declarations' })).to.be.null;
      });

      context('when the git configuration makes patterns fixed strings', () => { // Operators may set `grep.patternType` in their own git configuration, and git log honours it
        before(() => {
          process.env.GIT_CONFIG_COUNT = '1'; // Injected in the git processes spawned meanwhile, as if set in a configuration file
          process.env.GIT_CONFIG_KEY_0 = 'grep.patternType';
          process.env.GIT_CONFIG_VALUE_0 = 'fixed';
        });

        after(() => {
          delete process.env.GIT_CONFIG_COUNT;
          delete process.env.GIT_CONFIG_KEY_0;
          delete process.env.GIT_CONFIG_VALUE_0;
        });

        it('still matches the message as a regular expression', async () => {
          expect(await Git.getLatestCommitSha(repositoryPath, { grep: '^Add Service [AB]$', filePath: 'declarations' })).to.equal(secondCommitSha);
        });
      });

      context('with a repository that has no commits yet', () => {
        let directory;

        before(async () => {
          directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ota-git-test-'));
          await new Git({ path: directory, author: { name: 'Test', email: 'test@example.com' } }).initialize();
        });

        after(() => fs.rm(directory, { recursive: true, force: true }));

        it('returns null', async () => {
          expect(await Git.getLatestCommitSha(directory, { grep: '^Add', filePath: 'declarations' })).to.be.null;
        });
      });
    });

    describe('.readFileAtCommit', () => {
      it('returns the file content as it was at the given commit', async () => {
        expect(await Git.readFileAtCommit(subdirectoryPath, firstCommitSha, 'Service A.json')).to.equal('{ "name": "Service A" }');
      });

      it('throws a GitObjectNotFoundError for a file absent from the commit', async () => {
        try {
          await Git.readFileAtCommit(subdirectoryPath, firstCommitSha, 'Service B.json');
        } catch (error) {
          expect(error).to.be.an.instanceOf(GitObjectNotFoundError);

          return;
        }

        expect.fail('No error was thrown');
      });
    });

    describe('.readFilesAtCommit', () => {
      it('returns the contents of the files as they were at the given commit, in the requested order', async () => {
        expect(await Git.readFilesAtCommit(subdirectoryPath, secondCommitSha, [ 'Service B.json', 'Service A.json' ])).to.deep.equal([ '{ "name": "Service B" }', '{ "name": "Service A" }' ]);
      });

      it('returns null for a file absent from the commit', async () => {
        expect(await Git.readFilesAtCommit(subdirectoryPath, firstCommitSha, [ 'Service A.json', 'Service B.json' ])).to.deep.equal([ '{ "name": "Service A" }', null ]);
      });

      it('returns an empty list when no file is requested', async () => {
        expect(await Git.readFilesAtCommit(subdirectoryPath, firstCommitSha, [])).to.deep.equal([]);
      });

      it('throws a GitObjectNotFoundError for an unknown commit', async () => {
        try {
          await Git.readFilesAtCommit(subdirectoryPath, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', ['Service A.json']);
        } catch (error) {
          expect(error).to.be.an.instanceOf(GitObjectNotFoundError);

          return;
        }

        expect.fail('No error was thrown');
      });

      context('when a file of the commit cannot be read', () => {
        const CONTENT = '{ "name": "Service A" }';
        let directory;
        let commitSha;

        before(async () => {
          directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ota-git-test-'));

          const git = new Git({ path: directory, author: { name: 'Test', email: 'test@example.com' } });
          const filePath = path.join(directory, 'Service A.json');

          await git.initialize();
          await fs.writeFile(filePath, CONTENT);
          await git.add(filePath);
          commitSha = await git.commit({ filePath, message: 'Add Service A' });

          const blobSha = crypto.createHash('sha1').update(`blob ${Buffer.byteLength(CONTENT)}\0${CONTENT}`).digest('hex'); // How git names the object holding this content
          const objectPath = path.join(directory, '.git', 'objects', blobSha.slice(0, 2), blobSha.slice(2));

          await fs.chmod(objectPath, 0o644);
          await fs.writeFile(objectPath, ''); // An empty object file, as left by a write interrupted by a crash
        });

        after(() => fs.rm(directory, { recursive: true, force: true }));

        it('rejects with the git error rather than reporting the file as absent', async () => {
          try {
            await Git.readFilesAtCommit(directory, commitSha, ['Service A.json']);
          } catch (error) {
            expect(error).not.to.be.an.instanceOf(GitObjectNotFoundError);
            expect(error.message).to.match(/is empty/);

            return;
          }

          expect.fail('No error was thrown');
        });
      });

      context('when git prints hints on its error output', () => {
        const CONTENT = '{ "name": "Service A" }';
        let directory;
        let commitSha;

        before(async () => {
          directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ota-git-test-'));

          const git = new Git({ path: directory, author: { name: 'Test', email: 'test@example.com' } });
          const filePath = path.join(directory, 'Service A.json');

          await git.initialize();
          await fs.writeFile(filePath, CONTENT);
          await git.add(filePath);
          commitSha = await git.commit({ filePath, message: 'Add Service A' });

          await fs.mkdir(path.join(directory, '.git', 'info'), { recursive: true });
          await fs.writeFile(path.join(directory, '.git', 'info', 'grafts'), `${commitSha}\n`); // A deprecated grafts file makes git print hints at each command
        });

        after(() => fs.rm(directory, { recursive: true, force: true }));

        it('still returns null for a file absent from the commit', async () => {
          expect(await Git.readFilesAtCommit(directory, commitSha, [ 'Service A.json', 'Service B.json' ])).to.deep.equal([ CONTENT, null ]);
        });
      });

      context('when git exits before reading all the names', () => {
        let directory;

        before(async () => {
          directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ota-git-test-')); // Not a repository, so git exits right away
        });

        after(() => fs.rm(directory, { recursive: true, force: true }));

        it('rejects with the git error', async () => {
          const fileNames = Array.from({ length: 50000 }, (value, index) => `Service ${index}/Terms of Service.json`); // Far more than a pipe buffer holds, so that writing them fails once git has exited

          try {
            await Git.readFilesAtCommit(directory, firstCommitSha, fileNames);
          } catch (error) {
            expect(error.message).to.match(/not a git repository/);

            return;
          }

          expect.fail('No error was thrown');
        });
      });

      context('with contents larger than a single output chunk', () => {
        const LARGE_CONTENT = 'é'.repeat(100000); // Multi-byte characters, so that sizes are counted in bytes rather than characters
        let largeFilesCommitSha;

        before(async () => {
          const git = new Git({ path: repositoryPath, author: { name: 'Test', email: 'test@example.com' } });

          await git.initialize();

          for (const fileName of [ 'Large A.json', 'Large B.json' ]) {
            const filePath = path.join(subdirectoryPath, fileName);

            await fs.writeFile(filePath, LARGE_CONTENT);
            await git.add(filePath);
            largeFilesCommitSha = await git.commit({ filePath, message: `Add ${fileName}` });
          }
        });

        it('returns each content in full', async () => {
          expect(await Git.readFilesAtCommit(subdirectoryPath, largeFilesCommitSha, [ 'Large A.json', 'Large B.json' ])).to.deep.equal([ LARGE_CONTENT, LARGE_CONTENT ]);
        });
      });
    });
  });
});

function runGit(repositoryPath, args) {
  return simpleGit(repositoryPath, { trimmed: true }).raw(args);
}
