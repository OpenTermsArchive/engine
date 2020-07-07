import fs from 'fs';
import chai from 'chai';

import { SNAPSHOTS_DIRECTORY, save, commit, record } from './recorder.js';
import { TYPES } from '../types.js';

const expect = chai.expect;

const SERVICE_PROVIDER_ID = 'test_service';
const TYPE = 'tos';
const FILE_CONTENT = 'ToS fixture data with UTF-8 çhãràčtęrs';
const EXPECTED_FILE_PATH = `${SNAPSHOTS_DIRECTORY}/${SERVICE_PROVIDER_ID}/${TYPES[TYPE].fileName}.html`;

describe('Recorder', () => {
  describe('#save', () => {
    context('when service’s directory already exist', () => {
      after(() => {
        fs.unlinkSync(EXPECTED_FILE_PATH);
      });

      it('creates a file for the given service', async () => {
        await save({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: TYPE,
          content: FILE_CONTENT,
          isFiltered: false
        });

        expect(fs.readFileSync(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(FILE_CONTENT);
      });
    });

    context('when service’s directory does not already exist', () => {
      const NEW_SERVICE_ID = 'test_not_existing_service';
      const NEW_SERVICE_EXPECTED_FILE_PATH = `${SNAPSHOTS_DIRECTORY}/${NEW_SERVICE_ID}/${TYPES[TYPE].fileName}.html`;

      after(() => {
        fs.unlinkSync(NEW_SERVICE_EXPECTED_FILE_PATH);
      });

      it('creates a directory and file for the given service', async () => {
        await save({
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
    const COMMIT_FILE_CONTENT = FILE_CONTENT + 'commit';

    before(async () => {
      return save({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: TYPE,
        content: COMMIT_FILE_CONTENT,
        isFiltered: false
      });
    });

    after(() => {
      fs.unlinkSync(EXPECTED_FILE_PATH);
    });

    it('commits the file for the given service', async () => {
      const id = await commit(EXPECTED_FILE_PATH, 'message');
      expect(id).to.not.be.null;
    });
  });

  describe('#record', () => {
    let id;
    const PERSIST_FILE_CONTENT = FILE_CONTENT + 'record';

    before(async () => {
      const { id: recordId } = await record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: TYPE,
        content: PERSIST_FILE_CONTENT,
        isFiltered: false
      });
      id = recordId;
    });

    after(() => {
      fs.unlinkSync(EXPECTED_FILE_PATH);
    });

    it('creates a file for the given service', () => {
      expect(fs.readFileSync(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(PERSIST_FILE_CONTENT);
    });

    it('commits the file for the given service', () => {
      expect(id).to.exist;
      expect(id).to.be.a('string');
    });
  });
});
