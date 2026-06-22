import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import fetch, { launchHeadlessBrowser, stopHeadlessBrowser, parseLanguage } from './fullDomFetcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SERVER_PORT = 8977;

use(chaiAsPromised);

const dynamicHTML = '<!DOCTYPE html><html><head><title>Dynamic Page</title><script>setTimeout(() => { document.body.innerHTML += "<div class=\'dynamic\'>Loaded</div>"; }, 100);</script></head><body></body></html>';
const delayedContentHTML = '<!DOCTYPE html><html><head><title>Delayed Content</title><script>setTimeout(() => { document.querySelector(".content").textContent = "Final content"; }, 100);</script></head><body><div class="content"></div></body></html>';
const langEchoHTML = '<!DOCTYPE html><html><body><script>document.body.setAttribute("data-language", navigator.language); document.body.setAttribute("data-languages", navigator.languages.join(","));</script></body></html>';
const stealthProbeHTML = '<!DOCTYPE html><html><body><script>document.body.setAttribute("data-webdriver", String(navigator.webdriver)); document.body.setAttribute("data-user-agent", navigator.userAgent); document.body.setAttribute("data-plugin-count", String(navigator.plugins.length)); document.body.setAttribute("data-viewport-width", String(window.innerWidth)); document.body.setAttribute("data-viewport-height", String(window.innerHeight)); (() => { const canvas = document.createElement("canvas"); const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl"); if (!gl) { document.body.setAttribute("data-webgl-vendor", "none"); return; } const ext = gl.getExtension("WEBGL_debug_renderer_info"); document.body.setAttribute("data-webgl-vendor", ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : ""); document.body.setAttribute("data-webgl-renderer", ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ""); })();</script></body></html>';

describe('Full DOM Fetcher', function () {
  this.timeout(80000);

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
      if (request.url === '/stealth-probe') {
        response.writeHead(200, { 'Content-Type': 'text/html' }).write(stealthProbeHTML);
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

      it('sends every configured tag as Accept-Language header', async () => {
        const result = await fetch(`http://127.0.0.1:${SERVER_PORT}/lang-header`, [], config);

        expect(result.content).to.match(/data-accept-language="fr-FR,fr[^"]*"/);
      });
    });

    context('with multiple comma-separated tags such as en-IE,en-GB,en', () => {
      const language = 'en-IE,en-GB,en';
      const config = { navigationTimeout: 5000, waitForElementsTimeout: 5000, language };

      before(async () => {
        await stopHeadlessBrowser();
        await launchHeadlessBrowser(language);
      });

      it('derives Accept-Language quality factors from tag order', async () => {
        const result = await fetch(`http://127.0.0.1:${SERVER_PORT}/lang-header`, [], config);

        expect(result.content).to.match(/data-accept-language="en-IE,en-GB;q=0\.9,en;q=0\.8"/);
      });
    });
  });

  describe('Stealth evasions', () => {
    // These assertions guard against a class of regressions where the puppeteer-extra-plugin-stealth fails to be registered before puppeteer.launch(): if it is registered later, puppeteer-extra never binds its onPageCreated hooks and all evasions stay inactive, leaving navigator.webdriver === true and HeadlessChrome in the UA.
    const config = { navigationTimeout: 5000, waitForElementsTimeout: 5000, language: 'en' };
    let content;

    before(async () => {
      ({ content } = await fetch(`http://127.0.0.1:${SERVER_PORT}/stealth-probe`, [], config));
    });

    it('hides navigator.webdriver', () => {
      expect(content).to.match(/data-webdriver="false"/);
    });

    it('removes HeadlessChrome from the user agent', () => {
      expect(content).not.to.match(/HeadlessChrome/);
    });

    it('uses a realistic viewport instead of Puppeteer default', () => {
      expect(content).to.match(/data-viewport-width="1920"/);
      expect(content).to.match(/data-viewport-height="1080"/);
    });

    it('exposes a non-empty navigator.plugins list', () => {
      const match = content.match(/data-plugin-count="(\d+)"/);

      expect(match).to.not.be.null;
      expect(Number(match[1])).to.be.greaterThan(0);
    });

    it('hides headless WebGL vendor and renderer signature', () => {
      expect(content).to.not.match(/data-webgl-vendor="[^"]*Google[^"]*"/);
      expect(content).to.not.match(/data-webgl-renderer="[^"]*(?:SwiftShader|ANGLE)[^"]*"/);
    });
  });
});

describe('parseLanguage', () => {
  context('with a single tag', () => {
    it('returns the tag as both locale and a singleton languages array', () => {
      expect(parseLanguage('en')).to.deep.equal({ locale: 'en', languages: ['en'] });
    });

    it('preserves the region of a regional tag', () => {
      expect(parseLanguage('fr-FR')).to.deep.equal({ locale: 'fr-FR', languages: ['fr-FR'] });
    });
  });

  context('with a comma-separated priority list', () => {
    it('splits every tag into the languages array and rejoins them as locale', () => {
      expect(parseLanguage('en-IE,en-GB,en')).to.deep.equal({ locale: 'en-IE,en-GB,en', languages: [ 'en-IE', 'en-GB', 'en' ] });
    });

    it('trims whitespace surrounding each tag', () => {
      expect(parseLanguage('fr-FR, fr')).to.deep.equal({ locale: 'fr-FR,fr', languages: [ 'fr-FR', 'fr' ] });
    });

    it('drops empty entries produced by consecutive commas', () => {
      expect(parseLanguage('en,,fr')).to.deep.equal({ locale: 'en,fr', languages: [ 'en', 'fr' ] });
    });

    it('drops a trailing comma', () => {
      expect(parseLanguage('en,fr,')).to.deep.equal({ locale: 'en,fr', languages: [ 'en', 'fr' ] });
    });
  });

  context('with quality factors', () => {
    it('throws for a priority list carrying quality factors', () => {
      expect(() => parseLanguage('en-IE,en-GB;q=0.9,en;q=0.8')).to.throw('Quality factors are not supported');
    });

    it('throws for a single tag carrying a quality factor', () => {
      expect(() => parseLanguage('en;q=1.0')).to.throw('Quality factors are not supported');
    });

    it('throws regardless of quality-factor letter case', () => {
      expect(() => parseLanguage('en-GB;Q=0.9,en')).to.throw('Quality factors are not supported');
    });
  });

  context('with invalid input', () => {
    it('throws when the value is not a string', () => {
      expect(() => parseLanguage(undefined)).to.throw('must be a string');
      expect(() => parseLanguage(42)).to.throw('must be a string');
    });

    it('throws when the value is empty or blank', () => {
      expect(() => parseLanguage('')).to.throw('must contain at least one tag');
      expect(() => parseLanguage('   ')).to.throw('must contain at least one tag');
    });

    it('throws when the value contains only separators', () => {
      expect(() => parseLanguage(',,')).to.throw('must contain at least one tag');
    });
  });
});
