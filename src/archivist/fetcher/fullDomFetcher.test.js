import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import fetch, { launchHeadlessBrowser, stopHeadlessBrowser } from './fullDomFetcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SERVER_PORT = 8977;

use(chaiAsPromised);

const dynamicHTML = '<!DOCTYPE html><html><head><title>Dynamic Page</title><script>setTimeout(() => { document.body.innerHTML += "<div class=\'dynamic\'>Loaded</div>"; }, 100);</script></head><body></body></html>';
const delayedContentHTML = '<!DOCTYPE html><html><head><title>Delayed Content</title><script>setTimeout(() => { document.querySelector(".content").textContent = "Final content"; }, 100);</script></head><body><div class="content"></div></body></html>';

describe('Full DOM Fetcher', function () {
  this.timeout(60000);

  let temporaryServer;
  let expectedPDFContent;

  before(async () => {
    await launchHeadlessBrowser();

    temporaryServer = http.createServer((request, response) => {
      if (request.url === '/dynamic') {
        response.writeHead(200, { 'Content-Type': 'text/html' }).write(dynamicHTML);
      }
      if (request.url === '/delayed-content') {
        response.writeHead(200, { 'Content-Type': 'text/html' }).write(delayedContentHTML);
      }
      if (request.url === '/terms.pdf') {
        expectedPDFContent = fs.readFileSync(path.resolve(__dirname, '../../../test/fixtures/terms.pdf'));
        response.writeHead(200, { 'Content-Type': 'application/pdf' }).write(expectedPDFContent);
      }

      return response.end();
    }).listen(SERVER_PORT);
  });

  after(async () => {
    if (temporaryServer) {
      temporaryServer.close();
    }
    await stopHeadlessBrowser();
  });

  describe('Browser lifecycle', () => {
    it('throws error when trying to fetch without launching browser', async () => {
      await stopHeadlessBrowser();
      await expect(fetch('http://example.com', [], { navigationTimeout: 5000, waitForElementsTimeout: 5000, language: 'en' }))
        .to.be.rejectedWith('The headless browser should be controlled manually');
      await launchHeadlessBrowser();
    });

    it('reuses existing browser instance', async () => {
      const browser1 = await launchHeadlessBrowser();
      const browser2 = await launchHeadlessBrowser();

      expect(browser1).to.equal(browser2);
    });
  });

  describe('#fetch', () => {
    const config = { navigationTimeout: 1000, waitForElementsTimeout: 1000, language: 'en' };

    it('waits for dynamically injected elements to appear in the DOM', async () => {
      const result = await fetch(`http://127.0.0.1:${SERVER_PORT}/dynamic`, ['.dynamic'], config);

      expect(result.content).to.match(/<body[^>]*>.*<div class="dynamic">Loaded<\/div>.*<\/body>/s);
    });

    it('fails when waiting for non-existent elements exceeds timeout', async () => {
      const url = `http://127.0.0.1:${SERVER_PORT}/dynamic`;
      const timeout = 10;

      await expect(fetch(url, ['.non-existent'], { ...config, navigationTimeout: timeout })).to.be.rejectedWith(`Timed out after ${timeout / 1000} seconds when trying to fetch '${url}'`);
    });

    context('when a DOM element exists but its content is loaded asynchronously', () => {
      it('waits for the element content to be fully loaded', async () => {
        const result = await fetch(`http://127.0.0.1:${SERVER_PORT}/delayed-content`, ['.content'], config);

        expect(result.content).to.match(/<div class="content">Final content<\/div>/);
      });

      it('fails when content loading exceeds navigation timeout', async () => {
        const url = `http://127.0.0.1:${SERVER_PORT}/delayed-content`;
        const timeout = 10;

        await expect(fetch(url, ['.content'], { ...config, navigationTimeout: timeout })).to.be.rejectedWith(`Timed out after ${timeout / 1000} seconds when trying to fetch '${url}'`);
      });
    });

    context('when URL targets a PDF file', () => {
      let content;
      let mimeType;
      const pdfUrl = `http://127.0.0.1:${SERVER_PORT}/terms.pdf`;

      before(async () => {
        ({ content, mimeType } = await fetch(pdfUrl, [], config));
      });

      it('returns a buffer for PDF content', () => {
        expect(content).to.be.an.instanceOf(Buffer);
      });

      it('returns the correct MIME type', () => {
        expect(mimeType).to.equal('application/pdf');
      });

      it('returns the PDF file content', () => {
        expect(content.equals(expectedPDFContent)).to.be.true;
      });
    });
  });
});
