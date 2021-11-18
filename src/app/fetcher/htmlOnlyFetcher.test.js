import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';

import fetch from './htmlOnlyFetcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { expect } = chai;

chai.use(chaiAsPromised);

describe('HtmlOnlyFetcher', () => {
  let termsHTML;

  before(() => {
    termsHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>First provider TOS</title></head><body><h1>Terms of service</h1><p>Dapibus quis diam sagittis</p></body></html>';

    nock('https://domain.example', { reqheaders: { 'Accept-Language': 'en' } })
      .get('/terms.html')
      .reply(200, termsHTML, { 'Content-Type': 'text/html' });
  });

  after(() => {
    nock.restore();
  });

  describe('#fetch', () => {
    context('when url targets a PDF file', () => {
      let content;
      let mimeType;
      let expectedPDFContent;

      before(async () => {
        expectedPDFContent = fs.readFileSync(path.resolve(__dirname, '../../../test/fixtures/terms.pdf'));

        nock('https://domain.example.com', { reqheaders: { 'Accept-Language': 'en' } })
          .get('/terms.pdf')
          .reply(200, expectedPDFContent, { 'Content-Type': 'application/pdf' });

        const result = await fetch('https://domain.example.com/terms.pdf');

        content = result.content;
        mimeType = result.mimeType;
      });

      it('returns a buffer for PDF content', async () => {
        expect(content).to.be.an.instanceOf(Buffer);
      });

      it('returns a blob with the file type', async () => {
        expect(mimeType).to.equal('application/pdf');
      });

      it('returns a blob with the file content', async () => {
        expect(content.equals(expectedPDFContent)).to.be.true;
      });
    });
  });
});
