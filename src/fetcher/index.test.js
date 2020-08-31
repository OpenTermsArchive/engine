import chai from 'chai';
import nock from 'nock';
import fs from 'fs';
import path from 'path';

import fetch from './index.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const { expect } = chai;
const facebookTermsHTML = fs.readFileSync(path.resolve(__dirname, '../../test/fixtures/facebook_terms_raw.html'), { encoding: 'utf8' });

describe('Fetcher', () => {
  before(() => {
    nock('https://www.facebook.com', {
      reqheaders: { 'Accept-Language': 'en' }
    }).persist()
      .get('/terms.php')
      .reply(200, facebookTermsHTML);

    nock('https://not.available.document.com')
      .get('/')
      .reply(404);
  });

  describe('#fetch', () => {
    it('returns the web page content of the given URL', async () => {
      const result = await fetch('https://www.facebook.com/terms.php');
      expect(result).to.be.equal(facebookTermsHTML);
    });

    context('With returns as blob option', () => {
      it('returns the blob of the given URL', async () => {
        const result = await fetch('https://www.facebook.com/terms.php', { asRawData: true });
        expect(result.constructor.name).to.equal('Blob');
      });
    });

    context('when web page is not available', () => {
      it('throws an error', async () => {
        try {
          await fetch('https://not.available.document.com');
        } catch (e) {
          expect(e).to.be.an('error');
          expect(e.message).to.contain('404');
          return;
        }
        expect.fail('No error was thrown');
      });
    });
  });
});
