import chai from 'chai';
import nock from 'nock';

import scrape from './index.js';
import { facebookTermsHTML } from './fixtures.js';

const expect = chai.expect;

nock('https://www.facebook.com', {
    reqheaders: { 'Accept-Language': 'en' }
  }).get('/terms.php')
  .reply(200, facebookTermsHTML.en);

nock('https://www.facebook.com', {
    reqheaders: { 'Accept-Language': 'fr' }
  }).get('/terms.php')
  .reply(200, facebookTermsHTML.fr);

nock('https://not.available.document.com')
  .get('/')
  .reply(404);

describe('Scraper', () => {
  describe('#scrape', () => {
    it('returns the page content of the given URL', async () => {
      const result = await scrape('https://www.facebook.com/terms.php');
      expect(result).to.be.equal(facebookTermsHTML.en);
    });

    context('when document is not available', () => {
      it('throws an error', async () => {
        try {
          await scrape('https://not.available.document.com');
        } catch (e) {
          expect(e).to.be.an('error');
          expect(e.message).to.contain('404');
          return;
        }
        expect.fail('No error was thrown');
      });
    })
  });
});
