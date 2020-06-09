import chai from 'chai';
import fs from 'fs';
import path from 'path';
import nock from 'nock';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const expect = chai.expect;

import updateTerms from './index.js';
import { RAW_DIRECTORY, SANITIZED_DIRECTORY } from './history/history.js';

const facebookTermsHTML = fs.readFileSync(path.resolve(__dirname, '../fixtures/facebook_terms_raw.html'), { encoding: 'utf8' });
const facebookTermsMD = fs.readFileSync(path.resolve(__dirname, '../fixtures/facebook_terms_sanitized.md'), { encoding: 'utf8' });

nock('https://www.facebook.com', {
    reqheaders: { 'Accept-Language': 'en' }
  }).get('/legal/terms/plain_text_terms')
  .reply(200, facebookTermsHTML);

const SERVICE_PROVIDER_ID = 'facebook';
const POLICY_TYPE = 'terms_of_service';

const EXPECTED_RAW_FILE_PATH = `${RAW_DIRECTORY}/${SERVICE_PROVIDER_ID}/${POLICY_TYPE}.html`;
const EXPECTED_SANITIZED_FILE_PATH = `${SANITIZED_DIRECTORY}/${SERVICE_PROVIDER_ID}/${POLICY_TYPE}.md`;

describe('CGUs', () => {
  describe('#updateTerms', () => {
    before(async () => {
      await updateTerms();
    });
    
    after(() => {
      fs.unlinkSync(EXPECTED_RAW_FILE_PATH);
      fs.unlinkSync(EXPECTED_SANITIZED_FILE_PATH);
    });

    it('persists terms in raw format', async () => {
      const resultingRawTerms = fs.readFileSync(path.resolve(__dirname, EXPECTED_RAW_FILE_PATH), { encoding: 'utf8' });
      expect(resultingRawTerms).to.be.equal(facebookTermsHTML);
    });
    
    it('persists terms in sanitized format', async () => {
      const resultingSanitizedTerms = fs.readFileSync(path.resolve(__dirname, EXPECTED_SANITIZED_FILE_PATH), { encoding: 'utf8' });
      expect(resultingSanitizedTerms).to.be.equal(facebookTermsMD);
    });
  });
});
