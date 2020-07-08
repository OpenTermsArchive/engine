import chai from 'chai';
import fs from 'fs';
import path from 'path';
import nock from 'nock';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const expect = chai.expect;

import CGUs from './index.js';
import { SNAPSHOTS_DIRECTORY, VERSIONS_DIRECTORY } from './history/recorder.js';
import { TYPES } from './types.js';

const SERVICE_A_ID = 'service_A';
const SERVICE_A_TYPE = 'tos';
const SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH = `${SNAPSHOTS_DIRECTORY}/${SERVICE_A_ID}/${TYPES[SERVICE_A_TYPE].fileName}.html`;
const SERVICE_A_EXPECTED_VERSION_FILE_PATH = `${VERSIONS_DIRECTORY}/${SERVICE_A_ID}/${TYPES[SERVICE_A_TYPE].fileName}.md`;
const SERVICE_A_TOS_SNAPSHOT = fs.readFileSync(path.resolve(__dirname, '../test/fixtures/service_A_terms_snapshot.html'), { encoding: 'utf8' });
const SERVICE_A_TOS_VERSION = fs.readFileSync(path.resolve(__dirname, '../test/fixtures/service_A_terms.md'), { encoding: 'utf8' });

const SERVICE_B_ID = 'service_B';
const SERVICE_B_TYPE = 'tos';
const SERVICE_B_EXPECTED_SNAPSHOT_FILE_PATH = `${SNAPSHOTS_DIRECTORY}/${SERVICE_B_ID}/${TYPES[SERVICE_B_TYPE].fileName}.html`;
const SERVICE_B_EXPECTED_VERSION_FILE_PATH = `${VERSIONS_DIRECTORY}/${SERVICE_B_ID}/${TYPES[SERVICE_B_TYPE].fileName}.md`;
const SERVICE_B_TOS_SNAPSHOT = fs.readFileSync(path.resolve(__dirname, '../test/fixtures/service_B_terms_snapshot.html'), { encoding: 'utf8' });
const SERVICE_B_TOS_VERSION = fs.readFileSync(path.resolve(__dirname, '../test/fixtures/service_B_terms.md'), { encoding: 'utf8' });

nock('https://www.servicea.example').get('/tos')
  .reply(200, SERVICE_A_TOS_SNAPSHOT);

nock('https://www.serviceb.example').get('/tos')
  .reply(200, SERVICE_B_TOS_SNAPSHOT);

describe('CGUs', () => {
  describe('#trackChanges', () => {
    before(async () => {
      const app = new CGUs();
      await app.init();
      return app.trackChanges();
    });

    after(() => {
      fs.unlinkSync(SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH);
      fs.unlinkSync(SERVICE_A_EXPECTED_VERSION_FILE_PATH);
      fs.unlinkSync(SERVICE_B_EXPECTED_SNAPSHOT_FILE_PATH);
      fs.unlinkSync(SERVICE_B_EXPECTED_VERSION_FILE_PATH);
    });

    it('record snapshot terms for service A', () => {
      const resultingSnapshotTerms = fs.readFileSync(path.resolve(__dirname, SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH), { encoding: 'utf8' });
      expect(resultingSnapshotTerms).to.be.equal(SERVICE_A_TOS_SNAPSHOT);
    });

    it('record version for service A', () => {
      const resultingTerms = fs.readFileSync(path.resolve(__dirname, SERVICE_A_EXPECTED_VERSION_FILE_PATH), { encoding: 'utf8' });
      expect(resultingTerms).to.be.equal(SERVICE_A_TOS_VERSION);
    });

    it('record snapshot terms for service B', async () => {
      const resultingSnapshotTerms = fs.readFileSync(path.resolve(__dirname, SERVICE_B_EXPECTED_SNAPSHOT_FILE_PATH), { encoding: 'utf8' });
      expect(resultingSnapshotTerms).to.be.equal(SERVICE_B_TOS_SNAPSHOT);
    });

    it('record version for service B', async () => {
      const resultingTerms = fs.readFileSync(path.resolve(__dirname, SERVICE_B_EXPECTED_VERSION_FILE_PATH), { encoding: 'utf8' });
      expect(resultingTerms).to.be.equal(SERVICE_B_TOS_VERSION);
    });
  });
});
