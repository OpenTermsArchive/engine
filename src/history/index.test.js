import fs from 'fs';

import chai from 'chai';

import { storeRaw, RAW_DIRECTORY } from './index.js';

const expect = chai.expect;

const SERVICE_PROVIDER_ID = 'test_service_provider';
const POLICY_TYPE = 'terms_of_service';
const FILE_CONTENT = 'ToS fixture data with UTF-8 çhãràčtęrs';
const EXPECTED_FILE_PATH = `${RAW_DIRECTORY}/${SERVICE_PROVIDER_ID}/${POLICY_TYPE}.html`;


describe('History', () => {
  describe('#store', () => {
    after(() => {
      fs.unlinkSync(EXPECTED_FILE_PATH);
    });

    it('creates a file for the given service provider', async () => {
      await storeRaw(SERVICE_PROVIDER_ID, POLICY_TYPE, FILE_CONTENT);

      expect(fs.readFileSync(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(FILE_CONTENT);
    });
  });
});
