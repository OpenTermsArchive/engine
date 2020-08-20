import fs from 'fs';
import path from 'path';

import chai from 'chai';
import nock from 'nock';

import fetch from './index.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const { expect } = chai;

describe('Fetcher', () => {
  let termsHTML;

  before(() => {
    termsHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>First provider TOS</title></head><body><h1>Terms of service</h1><p>Dapibus quis diam sagittis</p></body></html>';

    nock('https://testdomain', { reqheaders: { 'Accept-Language': 'en' } })
      .get('/terms.html')
      .reply(200, termsHTML, { 'Content-Type': 'text/html' });
  });

  describe('#fetch', () => {
    it('returns the web page content of the given URL', async () => {
      const result = await fetch('https://testdomain/terms.html');
      expect(result).to.be.equal(termsHTML);
    });

    context('when web page is not available', () => {
      before(() => {
        nock('https://not.available.document.com')
          .get('/')
          .reply(404);
      });

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
      let expectedPDFContent;

      before(async () => {
        expectedPDFContent = fs.readFileSync(path.resolve(__dirname, '../../test/fixtures/terms.pdf'));

        nock('https://testdomain.com', { reqheaders: { 'Accept-Language': 'en' } })
          .get('/terms.pdf')
          .reply(200, expectedPDFContent, { 'Content-Type': 'application/pdf' });

        result = await fetch('https://testdomain.com/terms.pdf');
      });

      it('returns a blob', async () => {
        expect(result.constructor.name).to.equal('Blob');
      });

      it('returns a blob with the file type', async () => {
        expect(result.type).to.equal('application/pdf');
      });

      it('returns a blob with the file content', async () => {
        expect(Buffer.from(await result.arrayBuffer()).equals(expectedPDFContent)).to.be.true;
      });
    });
  });
});
