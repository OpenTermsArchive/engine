const { expect } = require('chai');
const nock = require('nock')

const scraper = require('./index');
const { facebookTermsHTML } = require('./fixtures');

const scope = nock('https://www.facebook.com')
  .get('/terms.php')
  .reply(200, facebookTermsHTML);

describe('Scraper', () => {
  describe('#scrape', () => {
    it("returns the page content of the given URL", () => {
      expect(scraper.scrape('https://www.facebook.com/terms.php')).to.be.equal(facebookTermsHTML);
    });
  });
});
