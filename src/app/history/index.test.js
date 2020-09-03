import fsApi from 'fs';

import chai from 'chai';

import { resetGitRepository, gitSnapshot, gitVersion } from '../../../test/helper.js';
import { SNAPSHOTS_PATH, VERSIONS_PATH, recordSnapshot, recordVersion, recordRefilter } from './index.js';

const fs = fsApi.promises;
const { expect } = chai;

describe('History', () => {
  const SERVICE_ID = 'test_service';
  const TYPE = 'Terms of Service';

  describe('#recordSnapshot', () => {
    const FILE_CONTENT = '<html><h1>ToS fixture data with UTF-8 çhãràčtęrs</h1></html>';
    const EXPECTED_FILE_PATH = `${SNAPSHOTS_PATH}/${SERVICE_ID}/${TYPE}.html`;
    const FIRST_COMMIT_MESSAGE = `Start tracking ${SERVICE_ID} ${TYPE}`;
    const MIME_TYPE = 'text/html';
    let id;
    let commit;
    let filepath;
    let isFirstRecord;

    before(async () => {
      const {
        id: snapshotId,
        path: snapshotPath,
        isFirstRecord: isFirstSnapshotRecord
      } = await recordSnapshot({
        serviceId: SERVICE_ID,
        documentType: TYPE,
        content: FILE_CONTENT,
        mimeType: MIME_TYPE
      });
      id = snapshotId;
      filepath = snapshotPath;
      isFirstRecord = isFirstSnapshotRecord;
      const commits = await gitSnapshot().log();
      [ commit ] = commits;
    });

    after(resetGitRepository);

    it('creates the file with the proper content', async () => {
      expect(await fs.readFile(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(FILE_CONTENT);
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
        const {
          id: snapshotId,
          path: snapshotPath,
          isFirstRecord: isFirstSnapshotRecord
        } = await recordSnapshot({
          serviceId: SERVICE_ID,
          documentType: TYPE,
          content: MODIFIED_FILE_CONTENT,
          mimeType: MIME_TYPE
        });
        id = snapshotId;
        filepath = snapshotPath;
        isFirstRecord = isFirstSnapshotRecord;
        const commits = await gitSnapshot().log();
        [ commit ] = commits;
      });

      it('creates the file with the proper content', async () => {
        expect(await fs.readFile(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(MODIFIED_FILE_CONTENT);
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
          const {
            id: snapshotId,
            path: snapshotPath,
          } = await recordSnapshot({
            serviceId: SERVICE_ID,
            documentType: TYPE,
            content: MODIFIED_FILE_CONTENT,
            mimeType: MIME_TYPE
          });
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
    const SNAPSHOT_ID = 'snapshot short sha';
    let id;
    let commit;
    let filepath;
    let isFirstRecord;

    before(async () => {
      const {
        id: versionId,
        path: versionPath,
        isFirstRecord: isFirstVersionRecord
      } = await recordVersion({
        serviceId: SERVICE_ID,
        documentType: TYPE,
        content: FILE_CONTENT,
        snapshotId: SNAPSHOT_ID,
      });
      id = versionId;
      filepath = versionPath;
      isFirstRecord = isFirstVersionRecord;
      const commits = await gitVersion().log();
      [ commit ] = commits;
    });

    after(resetGitRepository);

    it('creates the file with the proper content', async () => {
      expect(await fs.readFile(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(FILE_CONTENT);
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
      expect(commit.body).to.include(SNAPSHOT_ID);
    });

    context('when it is not the first record', () => {
      const MODIFIED_FILE_CONTENT = `${FILE_CONTENT}\n\n[link](#link)`;
      const UPDATE_COMMIT_MESSAGE = `Update ${SERVICE_ID} ${TYPE}`;

      before(async () => {
        const {
          id: versionId,
          path: versionPath,
          isFirstRecord: isFirstVersionRecord
        } = await recordVersion({
          serviceId: SERVICE_ID,
          documentType: TYPE,
          content: MODIFIED_FILE_CONTENT,
          snapshotId: SNAPSHOT_ID,
        });

        id = versionId;
        filepath = versionPath;
        isFirstRecord = isFirstVersionRecord;
        const commits = await gitVersion().log();
        [ commit ] = commits;
      });

      it('creates the file with the proper content', async () => {
        expect(await fs.readFile(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(MODIFIED_FILE_CONTENT);
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
        expect(commit.body).to.include(SNAPSHOT_ID);
      });

      context('when the content has not changed', () => {
        let commitsBefore;
        before(async () => {
          commitsBefore = await gitVersion().log();
          const {
            id: versionId,
            path: versionPath,
          } = await recordVersion({
            serviceId: SERVICE_ID,
            documentType: TYPE,
            content: MODIFIED_FILE_CONTENT,
            snapshotId: SNAPSHOT_ID,
          });
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
    const SNAPSHOT_ID = 'snapshot short sha';
    let id;
    let commit;
    let filepath;
    let isFirstRecord;

    before(async () => {
      const {
        id: versionId,
        path: versionPath,
        isFirstRecord: isFirstVersionRecord
      } = await recordRefilter({
        serviceId: SERVICE_ID,
        documentType: TYPE,
        content: FILE_CONTENT,
        snapshotId: SNAPSHOT_ID,
      });
      id = versionId;
      filepath = versionPath;
      isFirstRecord = isFirstVersionRecord;
      const commits = await gitVersion().log();
      [ commit ] = commits;
    });

    after(resetGitRepository);

    context('when it is the first record', () => {
      it('creates the file with the proper content', async () => {
        expect(await fs.readFile(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(FILE_CONTENT);
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
        expect(commit.body).to.include(SNAPSHOT_ID);
      });
    });

    context('when it is not the first record', () => {
      const MODIFIED_FILE_CONTENT = `${FILE_CONTENT}\n\n[link](#link)`;
      const UPDATE_COMMIT_MESSAGE = `Refilter ${SERVICE_ID} ${TYPE}`;

      before(async () => {
        const {
          id: versionId,
          path: versionPath,
          isFirstRecord: isFirstVersionRecord
        } = await recordRefilter({
          serviceId: SERVICE_ID,
          documentType: TYPE,
          content: MODIFIED_FILE_CONTENT,
          snapshotId: SNAPSHOT_ID,
        });
        id = versionId;
        filepath = versionPath;
        isFirstRecord = isFirstVersionRecord;
        const commits = await gitVersion().log();
        [ commit ] = commits;
      });

      it('creates the file with the proper content', async () => {
        expect(await fs.readFile(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(MODIFIED_FILE_CONTENT);
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
        expect(commit.body).to.include(SNAPSHOT_ID);
      });

      context('when the content has not changed', () => {
        let commitsBefore;

        before(async () => {
          commitsBefore = await gitVersion().log();
          const {
            id: versionId,
            path: versionPath,
          } = await recordRefilter({
            serviceId: SERVICE_ID,
            documentType: TYPE,
            content: MODIFIED_FILE_CONTENT,
            snapshotId: SNAPSHOT_ID,
          });
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
