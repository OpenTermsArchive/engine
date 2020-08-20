import chai from 'chai';
import nock from 'nock';
import fs from 'fs';
import path from 'path';

import fetch from './index.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const { expect } = chai;
const facebookTermsHTML = fs.readFileSync(path.resolve(__dirname, '../../test/fixtures/facebook_terms_raw.html'), { encoding: 'utf8' });
const termsPDF = fs.readFileSync(path.resolve(__dirname, '../../test/fixtures/terms.pdf'));

nock('https://www.facebook.com', { reqheaders: { 'Accept-Language': 'en' } })
  .get('/terms.php')
  .reply(200, facebookTermsHTML, { 'Content-Type': 'text/html' });

nock('https://testdomain.com', { reqheaders: { 'Accept-Language': 'en' } })
  .get('/terms.pdf')
  .reply(200, termsPDF, { 'Content-Type': 'application/pdf' });

nock('https://not.available.document.com')
  .get('/')
  .reply(404);

describe('Fetcher', () => {
  describe('#fetch', () => {
    it('returns the web page content of the given URL', async () => {
      const result = await fetch('https://www.facebook.com/terms.php');
      expect(result).to.be.equal(facebookTermsHTML);
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

    context('when url targets a PDF file', () => {
      let result;
      before(async () => {
        result = await fetch('https://testdomain.com/terms.pdf');
      });

      it('returns a blob', async () => {
        expect(result.constructor.name).to.equal('Blob');
      });

      it('returns a blob with the file type', async () => {
        expect(result.type).to.equal('application/pdf');
      });

      it('returns a blob with the file content', async () => {
        expect(Buffer.from(await result.arrayBuffer()).equals(termsPDF)).to.be.true;
      });
    });
  });
});
