import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { expect } from 'chai';
import config from 'config';

import Git from './git.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECORDER_PATH = path.resolve(__dirname, '../../../../../', config.get('@opentermsarchive/engine.recorder.versions.storage.git.path'));

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
});
