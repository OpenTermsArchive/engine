import fs from 'fs';
import chai from 'chai';

import { SNAPSHOTS_PATH, VERSIONS_PATH, recordSnapshot, recordVersion } from './index.js';
import { TYPES } from '../types.js';

const expect = chai.expect;

const SERVICE_ID = 'test_service';
const TYPE = 'tos';

const SNAPSHOT_FILE_CONTENT = '<html><h1>ToS fixture data with UTF-8 çhãràčtęrs</h1></html>';
const EXPECTED_SNAPSHOT_FILE_PATH = `${SNAPSHOTS_PATH}/${SERVICE_ID}/${TYPES[TYPE].fileName}.html`;

const VERSION_FILE_CONTENT = '# ToS fixture data with UTF-8 çhãràčtęrs';
const EXPECTED_VERSION_FILE_PATH = `${VERSIONS_PATH}/${SERVICE_ID}/${TYPES[TYPE].fileName}.md`;


describe('History', () => {
  describe('#recordSnapshot', () => {
    let id;
    before(async () => {
      const { id: snapshotId } = await recordSnapshot(SERVICE_ID, TYPE, SNAPSHOT_FILE_CONTENT);
      id = snapshotId;
    });

    after(() => {
      fs.unlinkSync(EXPECTED_SNAPSHOT_FILE_PATH);
    });

    it('creates a file for the given service', () => {
      expect(fs.readFileSync(EXPECTED_SNAPSHOT_FILE_PATH, { encoding: 'utf8' })).to.equal(SNAPSHOT_FILE_CONTENT);
    });

    it('commits the file for the given service', () => {
      expect(id).to.exist;
      expect(id).to.be.a('string');
    });
  });

  describe('#recordVersion', () => {
    let id;
    const snapshotId = 'commit-id';
    before(async () => {
      const { id: versionId } = await recordVersion(SERVICE_ID, TYPE, VERSION_FILE_CONTENT, snapshotId);
      id = versionId;
    });

    after(() => {
      fs.unlinkSync(EXPECTED_VERSION_FILE_PATH);
    });

    it('creates a file for the given service', () => {
      expect(fs.readFileSync(EXPECTED_VERSION_FILE_PATH, { encoding: 'utf8' })).to.equal(VERSION_FILE_CONTENT);
    });

    it('commits the file for the given service', () => {
      expect(id).to.exist;
      expect(id).to.be.a('string');
    });

    context('when snapshot ID is not provided', () => {
      it('throws an error', async () => {
        try {
          await recordVersion(SERVICE_ID, TYPE, VERSION_FILE_CONTENT);
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
