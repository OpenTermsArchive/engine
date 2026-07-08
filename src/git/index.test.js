import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { expect } from 'chai';
import config from 'config';

import Git from './index.js';

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
});
