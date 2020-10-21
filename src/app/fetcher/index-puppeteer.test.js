import fs from 'fs';
import path from 'path';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import http from 'http';

import fetch from './index.js';
import { InaccessibleContentError } from '../errors.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const { expect } = chai;
chai.use(chaiAsPromised);

describe('Fetcher Puppeteer', () => {
  let termsHTML;
  let temporaryServer;

  before(() => {
    termsHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>First provider TOS</title></head><body><h1>Terms of service</h1><p>Dapibus quis diam sagittis</p></body></html>';

    fs.readFile('./src/app/fetcher/index.html', (err, html) => {
      if (err) throw err;

      temporaryServer = http.createServer((request, response) => {
        response.writeHeader(200, { 'Content-Type': 'text/html' });
        response.write(html);
        response.end();
      }).listen(8080);
    });
  });

  describe('#fetch', () => {
    context('when web page is available', () => {
      let content;
      let mimeType;

      before(async () => {
        const result = await fetch('http://localhost:8080', true, 'body');
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

      it('throws an InaccessibleContentError error', async () => {
        await expect(fetch('https://not.available.example', true, 'body')).to.be.rejectedWith(InaccessibleContentError, /404/);
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

  after(() => {
    if (temporaryServer) {
      temporaryServer.close();
    }
  });
});
