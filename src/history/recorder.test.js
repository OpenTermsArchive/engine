import fs from 'fs';

import chai from 'chai';

import { resetGitRepository } from '../../test/helper.js';
import { SNAPSHOTS_PATH } from './index.js';
import Recorder from './recorder.js';
import * as TYPES from '../types.json';

const { expect } = chai;

const SERVICE_PROVIDER_ID = 'test_service';
const TYPE = 'tos';
const FILE_CONTENT = 'ToS fixture data with UTF-8 çhãràčtęrs';
const EXPECTED_FILE_PATH = `${SNAPSHOTS_PATH}/${SERVICE_PROVIDER_ID}/${TYPES.default[TYPE].fileName}.html`;

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
      const NEW_SERVICE_EXPECTED_FILE_PATH = `${SNAPSHOTS_PATH}/${NEW_SERVICE_ID}/${TYPES.default[TYPE].fileName}.html`;

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
});
