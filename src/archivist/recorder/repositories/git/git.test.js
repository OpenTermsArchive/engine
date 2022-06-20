import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { expect } from 'chai';
import config from 'config';

import Git from './git.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECORDER_PATH = path.resolve(__dirname, '../../../../../', config.get('recorder.versions.storage.git.path'));
const EXPECTED_FILE_PATH = `${RECORDER_PATH}/test.md`;

describe('GitRepository', () => {
  let subject;

  before(() => {
    subject = new Git({
      path: RECORDER_PATH,
      author: {
        name: config.get('recorder.versions.storage.git.author.name'),
        email: config.get('recorder.versions.storage.git.author.email'),
      },
    });

    return subject.initialize();
  });

  describe('#commit', () => {
    let commitId;

    before(async () => {
      await fs.writeFile(EXPECTED_FILE_PATH, 'content');

      await subject.add(EXPECTED_FILE_PATH);
      commitId = await subject.commit({ filepath: EXPECTED_FILE_PATH, message: 'Test message' });
    });

    after(() => fs.rmdir(RECORDER_PATH, { recursive: true }));

    it('returns a full length SHA1 commit ID', () => {
      expect(commitId).to.match(/\b[0-9a-f]{40}\b/);
    });
  });
});
