import fs from 'fs';
import chai from 'chai';

import { RAW_DIRECTORY, SANITIZED_DIRECTORY } from './persistor.js';
import { persistRaw, persistSanitized } from './index.js';
import { DOCUMENTS_TYPES } from '../documents_types.js';

const expect = chai.expect;

const SERVICE_PROVIDER_ID = 'test_service_provider';
const POLICY_TYPE = 'tos';

const RAW_FILE_CONTENT = '<html><h1>ToS fixture data with UTF-8 çhãràčtęrs</h1></html>';
const EXPECTED_RAW_FILE_PATH = `${RAW_DIRECTORY}/${SERVICE_PROVIDER_ID}/${DOCUMENTS_TYPES[POLICY_TYPE].fileName}.html`;

const SANITIZED_FILE_CONTENT = '# ToS fixture data with UTF-8 çhãràčtęrs';
const EXPECTED_SANITIZED_FILE_PATH = `${SANITIZED_DIRECTORY}/${SERVICE_PROVIDER_ID}/${DOCUMENTS_TYPES[POLICY_TYPE].fileName}.md`;


describe('History', () => {
  describe('#persistRaw', () => {
    let sha;
    before(async () => {
      const { sha: persistSha } = await persistRaw(SERVICE_PROVIDER_ID, POLICY_TYPE, RAW_FILE_CONTENT);
      sha = persistSha;
    });

    after(() => {
      fs.unlinkSync(EXPECTED_RAW_FILE_PATH);
    });

    it('creates a file for the given service provider', () => {
      expect(fs.readFileSync(EXPECTED_RAW_FILE_PATH, { encoding: 'utf8' })).to.equal(RAW_FILE_CONTENT);
    });

    it('commits the file for the given service provider', () => {
      expect(sha).to.exist;
      expect(sha).to.be.a('string');
    });
  });

  describe('#persistSanitized', () => {
    let sha;
    const relatedRawSha = 'commit-sha';
    before(async () => {
      const { sha: persistSha } = await persistSanitized(SERVICE_PROVIDER_ID, POLICY_TYPE, SANITIZED_FILE_CONTENT, relatedRawSha);
      sha = persistSha;
    });

    after(() => {
      fs.unlinkSync(EXPECTED_SANITIZED_FILE_PATH);
    });

    it('creates a file for the given service provider', () => {
      expect(fs.readFileSync(EXPECTED_SANITIZED_FILE_PATH, { encoding: 'utf8' })).to.equal(SANITIZED_FILE_CONTENT);
    });

    it('commits the file for the given service provider', () => {
      expect(sha).to.exist;
      expect(sha).to.be.a('string');
    });

    context('when related raw commit SHA is not provided', () => {
      it('throws an error', async () => {
        try {
          await persistSanitized(SERVICE_PROVIDER_ID, POLICY_TYPE, SANITIZED_FILE_CONTENT);
        } catch (e) {
          expect(e).to.be.an('error');
          expect(e.message).to.contain('raw commit SHA');
          return;
        }
        expect.fail('No error was thrown');
      });
    });
  });
});
