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
const langEchoHTML = '<!DOCTYPE html><html><body><script>document.body.setAttribute("data-language", navigator.language); document.body.setAttribute("data-languages", navigator.languages.join(","));</script></body></html>';
const langDetectHTML = '<!DOCTYPE html><html><body><div class="lang-detected"></div><script>const lang = navigator.language.split("-")[0]; const labels = { fr: "Conditions", en: "Terms" }; document.querySelector(".lang-detected").textContent = labels[lang] || labels.en;</script></body></html>';

describe('Full DOM Fetcher', function () {
  this.timeout(60000);

  let temporaryServer;
  let expectedPDFContent;

  before(async () => {
    await launchHeadlessBrowser('en');

    temporaryServer = http.createServer((request, response) => {
      if (request.url === '/dynamic') {
        response.writeHead(200, { 'Content-Type': 'text/html' }).write(dynamicHTML);
      }
      if (request.url === '/delayed-content') {
        response.writeHead(200, { 'Content-Type': 'text/html' }).write(delayedContentHTML);
      }
      if (request.url === '/lang-header') {
        const acceptLanguage = request.headers['accept-language'] || '';

        response.writeHead(200, { 'Content-Type': 'text/html' }).write(`<!DOCTYPE html><html><body data-accept-language="${acceptLanguage}"></body></html>`);
      }
      if (request.url === '/lang-echo') {
        response.writeHead(200, { 'Content-Type': 'text/html' }).write(langEchoHTML);
      }
      if (request.url === '/lang-detect') {
        response.writeHead(200, { 'Content-Type': 'text/html' }).write(langDetectHTML);
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
      await launchHeadlessBrowser('en');
    });

    it('reuses existing browser instance', async () => {
      const browser1 = await launchHeadlessBrowser('en');
      const browser2 = await launchHeadlessBrowser('en');

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

    it('sends the configured language as Accept-Language header', async () => {
      const result = await fetch(`http://127.0.0.1:${SERVER_PORT}/lang-header`, [], config);

      expect(result.content).to.match(/data-accept-language="en"/);
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

  describe('Language configuration', () => {
    context('with a regional locale such as fr-FR,fr', () => {
      const language = 'fr-FR,fr';
      const config = { navigationTimeout: 5000, waitForElementsTimeout: 5000, language };

      before(async () => {
        await stopHeadlessBrowser();
        await launchHeadlessBrowser(language);
      });

      it('exposes the primary tag through navigator.language', async () => {
        const result = await fetch(`http://127.0.0.1:${SERVER_PORT}/lang-echo`, [], config);

        expect(result.content).to.match(/data-language="fr-FR"/);
      });

      it('exposes every tag through navigator.languages', async () => {
        const result = await fetch(`http://127.0.0.1:${SERVER_PORT}/lang-echo`, [], config);

        expect(result.content).to.match(/data-languages="fr-FR,fr"/);
      });

      it('drives client-side language detection on the fetched document', async () => {
        const result = await fetch(`http://127.0.0.1:${SERVER_PORT}/lang-detect`, ['.lang-detected'], config);

        expect(result.content).to.match(/<div class="lang-detected">Conditions<\/div>/);
        expect(result.content).not.to.match(/>Terms</);
      });

      it('sends every configured tag as Accept-Language header', async () => {
        const result = await fetch(`http://127.0.0.1:${SERVER_PORT}/lang-header`, [], config);

        expect(result.content).to.match(/data-accept-language="fr-FR,fr[^"]*"/);
      });
    });

    context('with quality factors such as en-IE,en-GB;q=0.9,en;q=0.8', () => {
      const language = 'en-IE,en-GB;q=0.9,en;q=0.8';
      const config = { navigationTimeout: 5000, waitForElementsTimeout: 5000, language };

      before(async () => {
        await stopHeadlessBrowser();
        await launchHeadlessBrowser(language);
      });

      it('strips quality factors from navigator.languages', async () => {
        const result = await fetch(`http://127.0.0.1:${SERVER_PORT}/lang-echo`, [], config);

        expect(result.content).to.match(/data-languages="en-IE,en-GB,en"/);
      });

      it('preserves the configured quality factors in the Accept-Language header', async () => {
        const result = await fetch(`http://127.0.0.1:${SERVER_PORT}/lang-header`, [], config);

        expect(result.content).to.match(/data-accept-language="en-IE,en-GB;q=0\.9,en;q=0\.8"/);
      });
    });
  });
});
