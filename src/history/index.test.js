import fs from 'fs';
import path from 'path';
import chai from 'chai';

import { resetGitRepository, gitSnapshot, gitVersion } from '../../test/helper.js';
import { SNAPSHOTS_PATH, VERSIONS_PATH, recordSnapshot, recordPDFSnapshot, recordVersion, recordRefilter } from './index.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const { expect } = chai;

describe('History', () => {
  const SERVICE_ID = 'test_service';
  const TYPE = 'Terms of Service';

  describe('#recordSnapshot', () => {
    const FILE_CONTENT = '<html><h1>ToS fixture data with UTF-8 çhãràčtęrs</h1></html>';
    const EXPECTED_FILE_PATH = `${SNAPSHOTS_PATH}/${SERVICE_ID}/${TYPE}.html`;
    const FIRST_COMMIT_MESSAGE = `Start tracking ${SERVICE_ID} ${TYPE}`;
    let id;
    let commit;
    let filepath;
    let isFirstRecord;

    before(async () => {
      const { id: snapshotId, path: snapshotPath, isFirstRecord: isFirstSnapshotRecord } = await recordSnapshot(SERVICE_ID, TYPE, FILE_CONTENT);
      id = snapshotId;
      filepath = snapshotPath;
      isFirstRecord = isFirstSnapshotRecord;
      const commits = await gitSnapshot().log();
      [ commit ] = commits;
    });

    after(resetGitRepository);

    it('creates the file with the proper content', () => {
      expect(fs.readFileSync(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(FILE_CONTENT);
    });

    it('returns the file path', () => {
      expect(filepath).to.equal(EXPECTED_FILE_PATH);
    });

    it('returns a boolean to know if it is the first record', async () => {
      expect(isFirstRecord).to.be.true;
    });

    it('returns the id of the commit', async () => {
      expect(commit.hash).to.include(id);
    });

    it('properly saves the commit message', async () => {
      expect(commit.message).to.equal(FIRST_COMMIT_MESSAGE);
    });

    context('when it is not the first record', () => {
      const MODIFIED_FILE_CONTENT = `${FILE_CONTENT}\n\n[link](#link)`;
      const UPDATE_COMMIT_MESSAGE = `Update ${SERVICE_ID} ${TYPE}`;

      before(async () => {
        const { id: snapshotId, path: snapshotPath, isFirstRecord: isFirstSnapshotRecord } = await recordSnapshot(SERVICE_ID, TYPE, MODIFIED_FILE_CONTENT);
        id = snapshotId;
        filepath = snapshotPath;
        isFirstRecord = isFirstSnapshotRecord;
        const commits = await gitSnapshot().log();
        [ commit ] = commits;
      });

      it('creates the file with the proper content', () => {
        expect(fs.readFileSync(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(MODIFIED_FILE_CONTENT);
      });

      it('returns the file path', () => {
        expect(filepath).to.equal(EXPECTED_FILE_PATH);
      });

      it('returns a boolean to know if it is the first record', async () => {
        expect(isFirstRecord).to.be.false;
      });

      it('returns the id of the commit', async () => {
        expect(commit.hash).to.include(id);
      });

      it('properly saves the commit message', async () => {
        expect(commit.message).to.equal(UPDATE_COMMIT_MESSAGE);
      });

      context('when the content has not changed', () => {
        let commitsBefore;
        before(async () => {
          commitsBefore = await gitSnapshot().log();
          const { id: snapshotId, path: snapshotPath } = await recordSnapshot(SERVICE_ID, TYPE, MODIFIED_FILE_CONTENT);
          id = snapshotId;
          filepath = snapshotPath;
        });

        it('does not commit', async () => {
          const commitsAfter = await gitSnapshot().log();
          expect(commitsAfter).to.deep.equal(commitsBefore);
        });
      });
    });
  });

  describe('#recordPDFSnapshot', () => {
    let expectedPDFContent;
    const EXPECTED_FILE_PATH = `${SNAPSHOTS_PATH}/${SERVICE_ID}/${TYPE}.pdf`;
    const FIRST_COMMIT_MESSAGE = `Start tracking ${SERVICE_ID} ${TYPE}`;
    let id;
    let commit;
    let filepath;
    let isFirstRecord;

    before(async () => {
      expectedPDFContent = fs.readFileSync(path.resolve(__dirname, '../../test/fixtures/terms.pdf'));
      const { id: snapshotId, path: snapshotPath, isFirstRecord: isFirstSnapshotRecord } = await recordPDFSnapshot(SERVICE_ID, TYPE, expectedPDFContent);
      id = snapshotId;
      filepath = snapshotPath;
      isFirstRecord = isFirstSnapshotRecord;
      const commits = await gitSnapshot().log();
      [ commit ] = commits;
    });

    after(resetGitRepository);

    it('creates the file with the proper content', () => {
      expect(fs.readFileSync(EXPECTED_FILE_PATH).equals(expectedPDFContent)).to.be.true;
    });

    it('returns the file path', () => {
      expect(filepath).to.equal(EXPECTED_FILE_PATH);
    });

    it('returns a boolean to know if it is the first record', async () => {
      expect(isFirstRecord).to.be.true;
    });

    it('returns the id of the commit', async () => {
      expect(commit.hash).to.include(id);
    });

    it('properly saves the commit message', async () => {
      expect(commit.message).to.equal(FIRST_COMMIT_MESSAGE);
    });

    context('when it is not the first record', () => {
      const UPDATE_COMMIT_MESSAGE = `Update ${SERVICE_ID} ${TYPE}`;

      before(async () => {
        expectedPDFContent = fs.readFileSync(path.resolve(__dirname, '../../test/fixtures/termsModified.pdf'));
        const { id: snapshotId, path: snapshotPath, isFirstRecord: isFirstSnapshotRecord } = await recordPDFSnapshot(SERVICE_ID, TYPE, expectedPDFContent);
        id = snapshotId;
        filepath = snapshotPath;
        isFirstRecord = isFirstSnapshotRecord;
        const commits = await gitSnapshot().log();
        [ commit ] = commits;
      });

      it('creates the file with the proper content', () => {
        expect(fs.readFileSync(EXPECTED_FILE_PATH).equals(expectedPDFContent)).to.be.true;
      });

      it('returns the file path', () => {
        expect(filepath).to.equal(EXPECTED_FILE_PATH);
      });

      it('returns a boolean to know if it is the first record', async () => {
        expect(isFirstRecord).to.be.false;
      });

      it('returns the id of the commit', async () => {
        expect(commit.hash).to.include(id);
      });

      it('properly saves the commit message', async () => {
        expect(commit.message).to.equal(UPDATE_COMMIT_MESSAGE);
      });

      context('when the content has not changed', () => {
        let commitsBefore;
        before(async () => {
          commitsBefore = await gitSnapshot().log();
          const { id: snapshotId, path: snapshotPath } = await recordPDFSnapshot(SERVICE_ID, TYPE, expectedPDFContent);
          id = snapshotId;
          filepath = snapshotPath;
        });

        it('does not commit', async () => {
          const commitsAfter = await gitSnapshot().log();
          expect(commitsAfter).to.deep.equal(commitsBefore);
        });
      });
    });
  });

  describe('#recordVersion', () => {
    const FILE_CONTENT = '# ToS fixture data with UTF-8 çhãràčtęrs';
    const EXPECTED_FILE_PATH = `${VERSIONS_PATH}/${SERVICE_ID}/${TYPE}.md`;
    const FIRST_COMMIT_MESSAGE = `Start tracking ${SERVICE_ID} ${TYPE}`;
    const SNAPSHOTS_ID = 'snapshot short sha';
    let id;
    let commit;
    let filepath;
    let isFirstRecord;

    before(async () => {
      const { id: versionId, path: versionPath, isFirstRecord: isFirstVersionRecord } = await recordVersion(SERVICE_ID, TYPE, FILE_CONTENT, SNAPSHOTS_ID);
      id = versionId;
      filepath = versionPath;
      isFirstRecord = isFirstVersionRecord;
      const commits = await gitVersion().log();
      [ commit ] = commits;
    });

    after(resetGitRepository);

    it('creates the file with the proper content', () => {
      expect(fs.readFileSync(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(FILE_CONTENT);
    });

    it('returns the file path', () => {
      expect(filepath).to.equal(EXPECTED_FILE_PATH);
    });

    it('returns a boolean to know if it is the first record', async () => {
      expect(isFirstRecord).to.be.true;
    });

    it('returns the id of the commit', async () => {
      expect(commit.hash).to.include(id);
    });

    it('properly saves the commit message', async () => {
      expect(commit.message).to.equal(FIRST_COMMIT_MESSAGE);
    });

    it('properly adds snapshot’s id in the commit body', async () => {
      expect(commit.body).to.include(SNAPSHOTS_ID);
    });

    context('when it is not the first record', () => {
      const MODIFIED_FILE_CONTENT = `${FILE_CONTENT}\n\n[link](#link)`;
      const UPDATE_COMMIT_MESSAGE = `Update ${SERVICE_ID} ${TYPE}`;

      before(async () => {
        const { id: versionId, path: versionPath, isFirstRecord: isFirstVersionRecord } = await recordVersion(SERVICE_ID, TYPE, MODIFIED_FILE_CONTENT, SNAPSHOTS_ID);
        id = versionId;
        filepath = versionPath;
        isFirstRecord = isFirstVersionRecord;
        const commits = await gitVersion().log();
        [ commit ] = commits;
      });

      it('creates the file with the proper content', () => {
        expect(fs.readFileSync(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(MODIFIED_FILE_CONTENT);
      });

      it('returns the file path', () => {
        expect(filepath).to.equal(EXPECTED_FILE_PATH);
      });

      it('returns a boolean to know if it is the first record', async () => {
        expect(isFirstRecord).to.be.false;
      });

      it('returns the id of the commit', async () => {
        expect(commit.hash).to.include(id);
      });

      it('properly saves the commit message', async () => {
        expect(commit.message).to.equal(UPDATE_COMMIT_MESSAGE);
      });

      it('properly adds snapshot’s id in the commit body', async () => {
        expect(commit.body).to.include(SNAPSHOTS_ID);
      });

      context('when the content has not changed', () => {
        let commitsBefore;
        before(async () => {
          commitsBefore = await gitVersion().log();
          const { id: versionId, path: versionPath } = await recordVersion(SERVICE_ID, TYPE, MODIFIED_FILE_CONTENT, SNAPSHOTS_ID);
          id = versionId;
          filepath = versionPath;
          const commits = await gitVersion().log();
          [ commit ] = commits;
        });

        it('does not commit', async () => {
          const commitsAfter = await gitVersion().log();
          expect(commitsAfter).to.deep.equal(commitsBefore);
        });
      });
    });

    context('when snapshot ID is not provided', () => {
      it('throws an error', async () => {
        try {
          await recordVersion(SERVICE_ID, TYPE, FILE_CONTENT);
        } catch (e) {
          expect(e).to.be.an('error');
          expect(e.message).to.contain('snapshot ID');
          return;
        }
        expect.fail('No error was thrown');
      });
    });
  });

  describe('#recordRefilter', () => {
    const FILE_CONTENT = 'ToS fixture data with UTF-8 çhãràčtęrs\n------------------';
    const EXPECTED_FILE_PATH = `${VERSIONS_PATH}/${SERVICE_ID}/${TYPE}.md`;
    const FIRST_RECORD_COMMIT_MESSAGE = `Start tracking ${SERVICE_ID} ${TYPE}`;
    const SNAPSHOTS_ID = 'snapshot short sha';
    let id;
    let commit;
    let filepath;
    let isFirstRecord;

    before(async () => {
      const { id: versionId, path: versionPath, isFirstRecord: isFirstVersionRecord } = await recordRefilter(SERVICE_ID, TYPE, FILE_CONTENT, SNAPSHOTS_ID);
      id = versionId;
      filepath = versionPath;
      isFirstRecord = isFirstVersionRecord;
      const commits = await gitVersion().log();
      [ commit ] = commits;
    });

    after(resetGitRepository);

    context('when it is the first record', () => {
      it('creates the file with the proper content', () => {
        expect(fs.readFileSync(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(FILE_CONTENT);
      });

      it('returns the file path', () => {
        expect(filepath).to.equal(EXPECTED_FILE_PATH);
      });

      it('returns a boolean to know if it is the first record', async () => {
        expect(isFirstRecord).to.be.true;
      });

      it('returns the id of the commit', async () => {
        expect(commit.hash).to.include(id);
      });

      it('properly saves the commit message', async () => {
        expect(commit.message).to.equal(FIRST_RECORD_COMMIT_MESSAGE);
      });

      it('properly adds snapshot’s id in the commit body', async () => {
        expect(commit.body).to.include(SNAPSHOTS_ID);
      });
    });

    context('when it is not the first record', () => {
      const MODIFIED_FILE_CONTENT = `${FILE_CONTENT}\n\n[link](#link)`;
      const UPDATE_COMMIT_MESSAGE = `Refilter ${SERVICE_ID} ${TYPE}`;

      before(async () => {
        const { id: versionId, path: versionPath, isFirstRecord: isFirstVersionRecord } = await recordRefilter(SERVICE_ID, TYPE, MODIFIED_FILE_CONTENT, SNAPSHOTS_ID);
        id = versionId;
        filepath = versionPath;
        isFirstRecord = isFirstVersionRecord;
        const commits = await gitVersion().log();
        [ commit ] = commits;
      });

      it('creates the file with the proper content', () => {
        expect(fs.readFileSync(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(MODIFIED_FILE_CONTENT);
      });

      it('returns the file path', () => {
        expect(filepath).to.equal(EXPECTED_FILE_PATH);
      });

      it('returns a boolean to know if it is the first record', async () => {
        expect(isFirstRecord).to.be.false;
      });

      it('returns the id of the commit', async () => {
        expect(commit.hash).to.include(id);
      });

      it('properly saves the commit message', async () => {
        expect(commit.message).to.equal(UPDATE_COMMIT_MESSAGE);
      });

      it('properly adds snapshot’s id in the commit body', async () => {
        expect(commit.body).to.include(SNAPSHOTS_ID);
      });

      context('when the content has not changed', () => {
        let commitsBefore;

        before(async () => {
          commitsBefore = await gitVersion().log();
          const { id: versionId, path: versionPath } = await recordRefilter(SERVICE_ID, TYPE, MODIFIED_FILE_CONTENT, SNAPSHOTS_ID);
          id = versionId;
          filepath = versionPath;
          const commits = await gitVersion().log();
          [ commit ] = commits;
        });

        it('does not commit', async () => {
          const commitsAfter = await gitVersion().log();
          expect(commitsAfter).to.deep.equal(commitsBefore);
        });
      });
    });

    context('when snapshot ID is not provided', () => {
      it('throws an error', async () => {
        try {
          await recordVersion(SERVICE_ID, TYPE, FILE_CONTENT);
        } catch (e) {
          expect(e).to.be.an('error');
          expect(e.message).to.contain('snapshot ID');
          return;
        }
        expect.fail('No error was thrown');
      });
    });
  });
});
