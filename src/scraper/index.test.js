import chai from 'chai';
import nock from 'nock';

import { scrape } from './index.js';
import { facebookTermsHTML } from './fixtures.js';

const expect = chai.expect;

const scope = nock('https://www.facebook.com')
  .get('/terms.php')
  .reply(200, facebookTermsHTML);

describe('Scraper', () => {
  describe('#scrape', () => {
    it("returns the page content of the given URL", () => {
      expect(scrape('https://www.facebook.com/terms.php')).to.be.equal(facebookTermsHTML);
    });
  });
});
