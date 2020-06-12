import chai from 'chai';
import fs from 'fs';
import path from 'path';
import nock from 'nock';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const expect = chai.expect;

import updateTerms from './index.js';
import { RAW_DIRECTORY, SANITIZED_DIRECTORY } from './history/persistor.js';

const FIRST_SERVICE_PROVIDER_ID = 'first_provider';
const FIRST_SERVICE_PROVIDER_POLICY_TYPE = 'tos';
const FIRST_SERVICE_PROVIDER_EXPECTED_RAW_FILE_PATH = `${RAW_DIRECTORY}/${FIRST_SERVICE_PROVIDER_ID}/${FIRST_SERVICE_PROVIDER_POLICY_TYPE}.html`;
const FIRST_SERVICE_PROVIDER_EXPECTED_SANITIZED_FILE_PATH = `${SANITIZED_DIRECTORY}/${FIRST_SERVICE_PROVIDER_ID}/${FIRST_SERVICE_PROVIDER_POLICY_TYPE}.md`;
const FIRST_SERVICE_PROVIDER_TOS_RAW = fs.readFileSync(path.resolve(__dirname, '../test/fixtures/first_provider_terms_raw.html'), { encoding: 'utf8' });
const FIRST_SERVICE_PROVIDER_TOS_SANITIZED = fs.readFileSync(path.resolve(__dirname, '../test/fixtures/first_provider_terms_sanitized.md'), { encoding: 'utf8' });

const SECOND_SERVICE_PROVIDER_ID = 'second_provider';
const SECOND_SERVICE_PROVIDER_POLICY_TYPE = 'tos';
const SECOND_SERVICE_PROVIDER_EXPECTED_RAW_FILE_PATH = `${RAW_DIRECTORY}/${SECOND_SERVICE_PROVIDER_ID}/${SECOND_SERVICE_PROVIDER_POLICY_TYPE}.html`;
const SECOND_SERVICE_PROVIDER_EXPECTED_SANITIZED_FILE_PATH = `${SANITIZED_DIRECTORY}/${SECOND_SERVICE_PROVIDER_ID}/${SECOND_SERVICE_PROVIDER_POLICY_TYPE}.md`;
const SECOND_SERVICE_PROVIDER_TOS_RAW = fs.readFileSync(path.resolve(__dirname, '../test/fixtures/second_provider_terms_raw.html'), { encoding: 'utf8' });
const SECOND_SERVICE_PROVIDER_TOS_SANITIZED = fs.readFileSync(path.resolve(__dirname, '../test/fixtures/second_provider_terms_sanitized.md'), { encoding: 'utf8' });

nock('https://www.firstprovider.example').get('/tos')
  .reply(200, FIRST_SERVICE_PROVIDER_TOS_RAW);

nock('https://www.secondprovider.example').get('/tos')
  .reply(200, SECOND_SERVICE_PROVIDER_TOS_RAW);

describe('CGUs', () => {
  describe('#updateTerms', () => {
    before(async () => {
      await updateTerms();
    });

    after(() => {
      fs.unlinkSync(FIRST_SERVICE_PROVIDER_EXPECTED_RAW_FILE_PATH);
      fs.unlinkSync(FIRST_SERVICE_PROVIDER_EXPECTED_SANITIZED_FILE_PATH);
      fs.unlinkSync(SECOND_SERVICE_PROVIDER_EXPECTED_RAW_FILE_PATH);
      fs.unlinkSync(SECOND_SERVICE_PROVIDER_EXPECTED_SANITIZED_FILE_PATH);
    });

    it('persists terms in raw format for first service provider', () => {
      const resultingRawTerms = fs.readFileSync(path.resolve(__dirname, FIRST_SERVICE_PROVIDER_EXPECTED_RAW_FILE_PATH), { encoding: 'utf8' });
      expect(resultingRawTerms).to.be.equal(FIRST_SERVICE_PROVIDER_TOS_RAW);
    });

    it('persists terms in sanitized format for first service provider', () => {
      const resultingSanitizedTerms = fs.readFileSync(path.resolve(__dirname, FIRST_SERVICE_PROVIDER_EXPECTED_SANITIZED_FILE_PATH), { encoding: 'utf8' });
      expect(resultingSanitizedTerms).to.be.equal(FIRST_SERVICE_PROVIDER_TOS_SANITIZED);
    });

    it('persists terms in raw format for second service provider', async () => {
      const resultingRawTerms = fs.readFileSync(path.resolve(__dirname, SECOND_SERVICE_PROVIDER_EXPECTED_RAW_FILE_PATH), { encoding: 'utf8' });
      expect(resultingRawTerms).to.be.equal(SECOND_SERVICE_PROVIDER_TOS_RAW);
    });

    it('persists terms in sanitized format for second service provider', async () => {
      const resultingSanitizedTerms = fs.readFileSync(path.resolve(__dirname, SECOND_SERVICE_PROVIDER_EXPECTED_SANITIZED_FILE_PATH), { encoding: 'utf8' });
      expect(resultingSanitizedTerms).to.be.equal(SECOND_SERVICE_PROVIDER_TOS_SANITIZED);
    });
  });
});
