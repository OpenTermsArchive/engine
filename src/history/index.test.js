import fs from 'fs';
import chai from 'chai';

import { RAW_DIRECTORY, storeRaw, commitRaw, persistRaw } from './index.js';

const expect = chai.expect;

const SERVICE_PROVIDER_ID = 'test_service_provider';
const POLICY_TYPE = 'terms_of_service';
const FILE_CONTENT = 'ToS fixture data with UTF-8 çhãràčtęrs';
const EXPECTED_FILE_PATH = `${RAW_DIRECTORY}/${SERVICE_PROVIDER_ID}/${POLICY_TYPE}.html`;


describe('History', () => {
  describe('#storeRaw', () => {
    context("when service provider's directory already exist", () => {
      after(() => {
        fs.unlinkSync(EXPECTED_FILE_PATH);
      });

      it('creates a file for the given service provider', async () => {
        await storeRaw(SERVICE_PROVIDER_ID, POLICY_TYPE, FILE_CONTENT);

        expect(fs.readFileSync(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(FILE_CONTENT);
      });
    });

    context("when service provider's directory not already exist", () => {
      const NOT_EXISTING_SERVICE_PROVIDER_ID = 'test_not_existing_service_provider';
      const NOT_EXISTING_SERVICE_PROVIDER_EXPECTED_FILE_PATH = `${RAW_DIRECTORY}/${NOT_EXISTING_SERVICE_PROVIDER_ID}/${POLICY_TYPE}.html`;

      after(() => {
        fs.unlinkSync(NOT_EXISTING_SERVICE_PROVIDER_EXPECTED_FILE_PATH);
      });

      it('creates a directory and file for the given service provider', async () => {
        await storeRaw(NOT_EXISTING_SERVICE_PROVIDER_ID, POLICY_TYPE, FILE_CONTENT);

        expect(fs.readFileSync(NOT_EXISTING_SERVICE_PROVIDER_EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(FILE_CONTENT);
      });
    });
  });

  describe('#commitRaw', () => {
    before(async () => {
      await storeRaw(SERVICE_PROVIDER_ID, POLICY_TYPE, FILE_CONTENT);
    });

    after(() => {
      fs.unlinkSync(EXPECTED_FILE_PATH);
    });

    it('commits the file for the given service provider', async () => {
      const sha = await commitRaw(SERVICE_PROVIDER_ID, POLICY_TYPE);
      expect(sha).to.not.be.null;
    });
  });

  describe('#persistRaw', () => {
    before(async () => {
      await persistRaw(SERVICE_PROVIDER_ID, POLICY_TYPE, FILE_CONTENT);
    });

    after(() => {
      fs.unlinkSync(EXPECTED_FILE_PATH);
    });

    it('creates a file for the given service provider', async () => {
      expect(fs.readFileSync(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(FILE_CONTENT);
    });

    it('commits the file for the given service provider', async () => {
      expect(fs.readFileSync(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(FILE_CONTENT);
    });
  });
});
