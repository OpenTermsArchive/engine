import chai from 'chai';
import fs from 'fs';

import sanitize from './index.js';

const expect = chai.expect;

describe('Sanitizer', () => {
  let facebookTermsHTML;
  let facebookTermsMarkdown;

  describe('#sanitize', () => {
    before(() => {
      facebookTermsHTML = fs.readFileSync(`${process.cwd()}/fixtures/facebook_terms_raw.html`, { encoding: 'utf8' });
      facebookTermsMarkdown = fs.readFileSync(`${process.cwd()}/fixtures/facebook_terms_sanitized.md`, { encoding: 'utf8' });
    });

    it('returns the page content of the given URL', async () => {
      const result = await sanitize(facebookTermsHTML, '.UIFullPage_Container');
      expect(result).to.be.equal(facebookTermsMarkdown);
    });
  });
});
