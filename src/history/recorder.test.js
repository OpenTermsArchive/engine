import fs from 'fs';

import chai from 'chai';

import { resetGitRepository } from '../../test/helper.js';
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
        isFiltered: false
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
          isFiltered: false
        });

        expect(fs.readFileSync(NEW_SERVICE_EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(FILE_CONTENT);
      });
    });
  });

  describe('#commit', () => {
    const COMMIT_FILE_CONTENT = `${FILE_CONTENT}commit`;

    before(async () => subject.save({
      serviceId: SERVICE_PROVIDER_ID,
      documentType: TYPE,
      content: COMMIT_FILE_CONTENT,
      isFiltered: false
    }));

    after(resetGitRepository);

    it('commits the file for the given service', async () => {
      const id = await subject.commit(EXPECTED_FILE_PATH, 'message');
      expect(id).to.not.be.null;
    });
  });

  describe('#record', () => {
    let id;
    let isFirstRecord;
    const PERSIST_FILE_CONTENT = `${FILE_CONTENT}record`;

    before(async () => {
      const { id: recordId, isFirstRecord: firstRecord } = await subject.record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: TYPE,
        content: PERSIST_FILE_CONTENT,
        isFiltered: false
      });
      id = recordId;
      isFirstRecord = firstRecord;
    });

    after(resetGitRepository);

    it('creates a file for the given service', () => {
      expect(fs.readFileSync(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(PERSIST_FILE_CONTENT);
    });

    it('commits the file for the given service', () => {
      expect(id).to.exist;
      expect(id).to.be.a('string');
    });

    context('when this is the first record', () => {
      it('returns a boolean to specify this is the first one', () => {
        expect(isFirstRecord).to.equal(true);
      });
    });

    context('when this is not the first record', () => {
      it('returns a boolean to specify this is not the first one', async () => {
        const recordResult = await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: TYPE,
          content: PERSIST_FILE_CONTENT,
          isFiltered: false
        });
        expect(recordResult.isFirstRecord).to.equal(false);
      });
    });
  });

  describe('#_filePath', () => {
    it('returns the file path for the given service provider’s document type', async () => {
      expect(subject._filePath(SERVICE_PROVIDER_ID, TYPE)).to.equal(EXPECTED_FILE_PATH);
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
        isFiltered: false
      });
      firstRecordId = record.id;
      record = await subject.record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: TYPE,
        content: `${FILE_CONTENT}record`,
        isFiltered: false
      });
      secondRecordId = record.id;
    });

    after(resetGitRepository);

    it('returns all commits related to the given file path', async () => {
      const filePath = subject._filePath(SERVICE_PROVIDER_ID, TYPE);
      const commits = await subject._getCommits(filePath);
      expect(commits).to.have.length(2);
      expect(commits[0].hash).to.include(secondRecordId);
      expect(commits[1].hash).to.include(firstRecordId);
    });
  });

  describe('#getLatestRecord', () => {
    const PERSIST_FILE_CONTENT = `${FILE_CONTENT}record`;
    let lastSnapshotId;
    let lastestRecord;

    before(async () => {
      await subject.record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: TYPE,
        content: FILE_CONTENT,
        isFiltered: false
      });
      const { id: recordId } = await subject.record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: TYPE,
        content: PERSIST_FILE_CONTENT,
        isFiltered: false
      });
      lastSnapshotId = recordId;
      lastestRecord = await subject.getLatestRecord(SERVICE_PROVIDER_ID, TYPE);
    });

    after(resetGitRepository);

    it('return the latest record id', async () => {
      expect(lastestRecord.id).to.include(lastSnapshotId);
    });

    it('return the latest record path', async () => {
      expect(lastestRecord.path).to.equal(EXPECTED_FILE_PATH);
    });
  });
});
