import fs from 'fs';
import path from 'path';

import chai from 'chai';
import nock from 'nock';

import fetch from './index.js';
import { ERROR_TYPES } from '../errors.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const { expect } = chai;

describe('Fetcher', () => {
  let termsHTML;

  before(() => {
    termsHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>First provider TOS</title></head><body><h1>Terms of service</h1><p>Dapibus quis diam sagittis</p></body></html>';

    nock('https://domain.example', { reqheaders: { 'Accept-Language': 'en' } })
      .get('/terms.html')
      .reply(200, termsHTML, { 'Content-Type': 'text/html' });
  });

  describe('#fetch', () => {
    context('when web page is available', () => {
      let content;
      let mimeType;

      before(async () => {
        const result = await fetch('https://domain.example/terms.html');
        content = result.content;
        mimeType = result.mimeType;
      });

      it('returns the web page content of the given URL', async () => {
        expect(content).to.equal(termsHTML);
      });

      it('returns the mime type of the given URL', async () => {
        expect(mimeType).to.equal('text/html');
      });
    });

    context('when web page is not available', () => {
      before(() => {
        nock('https://not.available.example')
          .get('/')
          .reply(404);
      });

      it(`throws an "${ERROR_TYPES.inaccessibleContent.id}" error`, async () => {
        try {
          await fetch('https://not.available.example');
        } catch (e) {
          expect(e).to.be.an('error');
          expect(e.type).to.equal(ERROR_TYPES.inaccessibleContent.id);
          expect(e.message).to.contain('404');
          return;
        }
        expect.fail('No error was thrown');
      });
    });

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
