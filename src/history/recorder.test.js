import fs from 'fs';

import chai from 'chai';

import { resetGitRepository, gitSnapshot } from '../../test/helper.js';
import { SNAPSHOTS_PATH } from './index.js';
import Recorder from './recorder.js';

const { expect } = chai;

const SERVICE_PROVIDER_ID = 'test_service';
const TYPE = 'Terms of Service';
const FILE_CONTENT = 'ToS fixture data with UTF-8 çhãràčtęrs';
const EXPECTED_FILE_PATH = `${SNAPSHOTS_PATH}/${SERVICE_PROVIDER_ID}/${TYPE}.html`;

describe('Recorder', () => {
  let subject;

  before(() => {
    subject = new Recorder({ path: SNAPSHOTS_PATH, fileExtension: 'html' });
  });

  describe('#save', () => {
    context('when service’s directory already exist', () => {
      before(async () => subject.save({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: TYPE,
        content: FILE_CONTENT,
      }));

      after(resetGitRepository);

      it('creates a file for the given service', async () => {
        expect(fs.readFileSync(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(FILE_CONTENT);
      });
    });

    context('when service’s directory does not already exist', () => {
      const NEW_SERVICE_ID = 'test_not_existing_service';
      const NEW_SERVICE_EXPECTED_FILE_PATH = `${SNAPSHOTS_PATH}/${NEW_SERVICE_ID}/${TYPE}.html`;

      after(() => {
        fs.unlinkSync(NEW_SERVICE_EXPECTED_FILE_PATH);
      });

      it('creates a directory and file for the given service', async () => {
        await subject.save({
          serviceId: NEW_SERVICE_ID,
          documentType: TYPE,
          content: FILE_CONTENT,
        });

        expect(fs.readFileSync(NEW_SERVICE_EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(FILE_CONTENT);
      });
    });
  });

  describe('#commit', () => {
    const commitMessage = 'Message to check if the commit message is properly saved';
    let id;
    let commit;

    before(async () => {
      await subject.save({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: TYPE,
        content: FILE_CONTENT,
      });
      id = await subject.commit(EXPECTED_FILE_PATH, commitMessage);
      const commits = await gitSnapshot().log();
      [commit] = commits;
    });

    after(resetGitRepository);

    it('returns the id of the commit', async () => {
      expect(commit.hash).to.includes(id);
    });

    it('properly saves the commit message', async () => {
      expect(commit.message).to.equal(commitMessage);
    });
  });

  describe('#record', () => {
    const changelog = 'Changelog to save in the commit message';
    let id;
    let path;
    let commit;

    before(async () => {
      const { id: recordId, path: recordFilePath } = await subject.record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: TYPE,
        content: FILE_CONTENT,
        changelog,
      });
      id = recordId;
      path = recordFilePath;
      const commits = await gitSnapshot().log();
      [commit] = commits;
    });

    after(resetGitRepository);

    it('creates the file with the proper content', () => {
      expect(fs.readFileSync(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(FILE_CONTENT);
    });

    it('returns the file path', () => {
      expect(path).to.equal(EXPECTED_FILE_PATH);
    });

    it('returns the commit id', () => {
      expect(commit.hash).to.include(id);
    });

    it('saves the changelog in the commit message', () => {
      expect(commit.message).to.equal(changelog);
    });
  });

  describe('#getPathFor', () => {
    it('returns the file path for the given service provider’s document type', async () => {
      expect(subject.getPathFor(SERVICE_PROVIDER_ID, TYPE)).to.equal(EXPECTED_FILE_PATH);
    });
  });

  describe('#isTracked', () => {
    after(resetGitRepository);

    context('when the file does not exists', () => {
      it('returns false', async () => {
        expect(await subject.isTracked(SERVICE_PROVIDER_ID, TYPE)).to.be.false;
      });
    });

    context('when the file already exists', () => {
      before(async () => {
        await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: TYPE,
          content: FILE_CONTENT,
          changelog: 'Start tracking document'
        });
      });

      it('returns true', async () => {
        expect(await subject.isTracked(SERVICE_PROVIDER_ID, TYPE)).to.be.true;
      });
    });
  });

  describe('#_getCommits', () => {
    let firstRecordId;
    let secondRecordId;
    before(async () => {
      let record = await subject.record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: TYPE,
        content: FILE_CONTENT,
      });
      firstRecordId = record.id;
      record = await subject.record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: TYPE,
        content: `${FILE_CONTENT} (with additional content to trigger a record)`,
      });
      secondRecordId = record.id;
    });

    after(resetGitRepository);

    it('returns all commits related to the given file path', async () => {
      const filePath = subject.getPathFor(SERVICE_PROVIDER_ID, TYPE);
      const commits = await subject._getCommits(filePath);
      expect(commits).to.have.length(2);
      expect(commits[0].hash).to.include(secondRecordId);
      expect(commits[1].hash).to.include(firstRecordId);
    });
  });

  describe('#getLatestRecord', () => {
    let lastSnapshotId;
    let latestRecord;

    before(async () => {
      await subject.record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: TYPE,
        content: FILE_CONTENT,
      });
      const { id: recordId } = await subject.record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: TYPE,
        content: `${FILE_CONTENT} (with additional content to trigger a record)`,
      });
      lastSnapshotId = recordId;
      latestRecord = await subject.getLatestRecord(SERVICE_PROVIDER_ID, TYPE);
    });

    after(resetGitRepository);

    it('returns the latest record id', async () => {
      expect(latestRecord.id).to.include(lastSnapshotId);
    });

    it('returns the latest record path', async () => {
      expect(latestRecord.path).to.equal(EXPECTED_FILE_PATH);
    });
  });
});
