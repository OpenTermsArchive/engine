import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import iconv from 'iconv-lite';

import fetch, { launchHeadlessBrowser, stopHeadlessBrowser, FetchDocumentError, FETCHER_TYPES } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SERVER_PORT = 8976;

use(chaiAsPromised);

const termsHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>First provider TOS</title></head><body><h1>Terms of service</h1><p>Dapibus quis diam sagittis</p></body></html>';
const termsWithOtherCharsetHTML = '<!DOCTYPE html><html><head><meta http-equiv="Content-Type" content="text/html; charset=windows-1251"><title>TOS на първия доставчик</title></head><body><h1>Условия за ползване</h1><p>Dapibus quis diam sagittis</p></body></html>';
const progressiveHTML = '<!DOCTYPE html><html><head><script>let n = 0; const t = setInterval(() => { n += 1; const p = document.createElement("p"); p.textContent = "item" + n; document.querySelector("#list").appendChild(p); if (n >= 3) { clearInterval(t); } }, 80);</script></head><body><div id="list"><p>item0</p></div></body></html>';

describe('Fetcher', function () {
  this.timeout(60000);

  before(() => launchHeadlessBrowser('en'));

  after(stopHeadlessBrowser);

  describe('#fetch', () => {
    let temporaryServer;
    let expectedPDFContent;

    before(done => {
      let blockCount = 0;

      temporaryServer = http.createServer((request, response) => {
        if (request.url === '/') {
          response.writeHead(200, { 'Content-Type': 'text/html' }).write(termsHTML);
        }
        if (request.url === '/other-charset') {
          response.writeHead(200, { 'Content-Type': 'text/html' }).write(iconv.encode(termsWithOtherCharsetHTML, 'windows-1251'));
        }
        if (request.url == '/404') {
          response.writeHead(404, { 'Content-Type': 'text/html' }).write('<!DOCTYPE html><html><body>404</body></html>');
        }
        if (request.url === '/zero-content') {
          response.writeHead(200, { 'Content-Type': 'text/html', 'Content-Length': '0' }).write('');
        }
        if (request.url == '/terms.pdf') {
          expectedPDFContent = fs.readFileSync(path.resolve(__dirname, '../../../test/fixtures/terms.pdf'));
          response.writeHead(200, { 'Content-Type': 'application/pdf' }).write(expectedPDFContent);
        }
        if (request.url === '/block-once') {
          if (blockCount === 0) {
            blockCount++;
            response.writeHead(403, { 'Content-Type': 'text/html' }).write('<!DOCTYPE html><html><body>Access Denied - Bot Detected</body></html>');
          } else {
            response.writeHead(200, { 'Content-Type': 'text/html' }).write(termsHTML);
          }
        }
        if (request.url === '/always-block') {
          response.writeHead(403, { 'Content-Type': 'text/html' }).write('<!DOCTYPE html><html><body>Access Denied - Bot Detected</body></html>');
        }
        if (request.url === '/progressive') {
          response.writeHead(200, { 'Content-Type': 'text/html' }).write(progressiveHTML);
        }

        return response.end();
      }).listen(SERVER_PORT);

      done();
    });

    after(() => {
      if (temporaryServer) {
        temporaryServer.close();
      }
    });

    describe('Available URL', () => {
      context('when html page is available', () => {
        let content;
        let mimeType;
        let fetcher;
        const url = `http://127.0.0.1:${SERVER_PORT}`;

        context('when expected selectors are present', () => {
          before(async () => {
            ({ content, mimeType, fetcher } = await fetch({ url, cssSelectors: 'body' }));
          });

          it('returns the web page content of the given URL', () => {
            expect(content).to.equal(termsHTML);
          });

          it('returns the MIME type of the given URL', () => {
            expect(mimeType).to.equal('text/html');
          });

          it('uses HTML-only fetcher by default', () => {
            expect(fetcher).to.equal(FETCHER_TYPES.HTML_ONLY);
          });

          context('with client script enabled', () => {
            before(async () => {
              ({ content, mimeType, fetcher } = await fetch({ url, cssSelectors: 'body', executeClientScripts: true }));
            });

            it('returns the web page content of the given URL', () => {
              expect(content).to.equal(termsHTML);
            });

            it('returns the MIME type of the given URL', () => {
              expect(mimeType).to.equal('text/html');
            });

            it('uses full DOM fetcher when client scripts are enabled', () => {
              expect(fetcher).to.equal(FETCHER_TYPES.FULL_DOM);
            });
          });
        });

        context('when expected selectors are not present', () => {
          const NOT_PRESENT_SELECTOR = 'h2';

          before(async () => {
            ({ content, mimeType, fetcher } = await fetch({ url, cssSelectors: NOT_PRESENT_SELECTOR }));
          });

          it('returns the web page content of the given URL', () => {
            expect(content).to.equal(termsHTML);
          });

          it('returns the MIME type of the given URL', () => {
            expect(mimeType).to.equal('text/html');
          });

          it('uses HTML-only fetcher by default', () => {
            expect(fetcher).to.equal(FETCHER_TYPES.HTML_ONLY);
          });

          context('with client script enabled', () => {
            before(async () => {
              ({ content, mimeType, fetcher } = await fetch({ url, cssSelectors: NOT_PRESENT_SELECTOR, executeClientScripts: true }));
            });

            it('returns the web page content of the given URL', () => {
              expect(content).to.equal(termsHTML);
            });

            it('returns the MIME type of the given URL', () => {
              expect(mimeType).to.equal('text/html');
            });

            it('uses full DOM fetcher when client scripts are enabled', () => {
              expect(fetcher).to.equal(FETCHER_TYPES.FULL_DOM);
            });
          });
        });
      });

      context('when html page is in different charset', () => {
        let content;
        let fetcher;
        const url = `http://127.0.0.1:${SERVER_PORT}/other-charset`;

        context('when expected selectors are present', () => {
          before(async () => {
            ({ content, fetcher } = await fetch({ url, cssSelectors: 'body' }));
          });

          it('returns the web page content of the given URL', () => {
            expect(content).to.equal(termsWithOtherCharsetHTML);
          });

          it('uses HTML-only fetcher by default', () => {
            expect(fetcher).to.equal(FETCHER_TYPES.HTML_ONLY);
          });
        });
      });

      context('when url targets a PDF file', () => {
        let content;
        let mimeType;
        let fetcher;
        const pdfUrl = `http://127.0.0.1:${SERVER_PORT}/terms.pdf`;

        before(async () => {
          ({ content, mimeType, fetcher } = await fetch({ url: pdfUrl }));
        });

        it('returns a buffer for PDF content', () => {
          expect(content).to.be.an.instanceOf(Buffer);
        });

        it('returns a blob with the file type', () => {
          expect(mimeType).to.equal('application/pdf');
        });

        it('returns a blob with the file content', () => {
          expect(content.equals(expectedPDFContent)).to.be.true;
        });

        it('returns the fetcher used to fetch the PDF file', () => {
          expect(fetcher).to.equal(FETCHER_TYPES.HTML_ONLY);
        });
      });

      context('when server responds with empty content', () => {
        const zeroContentUrl = `http://127.0.0.1:${SERVER_PORT}/zero-content`;

        it('throws a FetchDocumentError error', async () => {
          await expect(fetch({ url: zeroContentUrl })).to.be.rejectedWith(FetchDocumentError, /empty content/);
        });
      });
    });

    describe('Error handling', () => {
      const url404 = `http://127.0.0.1:${SERVER_PORT}/404`;

      context('when web page is not available', () => {
        it('throws a FetchDocumentError error', async () => {
          await expect(fetch({ url: url404 })).to.be.rejectedWith(FetchDocumentError, /404/);
        });

        context('with client script enabled', () => {
          it('throws a FetchDocumentError error', async () => {
            await expect(fetch({ url: url404, executeClientScripts: true, cssSelectors: 'body' })).to.be.rejectedWith(FetchDocumentError, /404/);
          });
        });
      });

      context('when server is not resolved', () => {
        const notAvailableUrl = 'https://not.available.example';

        it('throws a FetchDocumentError error', async () => {
          await expect(fetch({ url: notAvailableUrl })).to.be.rejectedWith(FetchDocumentError);
        });

        context('with client script enabled', () => {
          it('throws a FetchDocumentError error', async () => {
            await expect(fetch({ url: notAvailableUrl, executeClientScripts: true })).to.be.rejectedWith(FetchDocumentError);
          });
        });
      });

      describe('when there is a certificate error', () => {
        context('when website has a self signed certificate', () => {
          const selfSignedSslUrl = 'https://self-signed.badssl.com/';

          it('throws a FetchDocumentError error', async () => {
            await expect(fetch({ url: selfSignedSslUrl })).to.be.rejectedWith(FetchDocumentError);
          });

          context('with client script enabled', () => {
            it('throws a FetchDocumentError error', async () => {
              await expect(fetch({ url: selfSignedSslUrl, executeClientScripts: true })).to.be.rejectedWith(FetchDocumentError);
            });
          });
        });

        context('when website has an expired certificate', () => {
          const expiredSslUrl = 'https://expired.badssl.com/';

          it('throws a FetchDocumentError error', async () => {
            await expect(fetch({ url: expiredSslUrl })).to.be.rejectedWith(FetchDocumentError);
          });

          context('with client script enabled', () => {
            it('throws a FetchDocumentError error', async () => {
              await expect(fetch({ url: expiredSslUrl, executeClientScripts: true })).to.be.rejectedWith(FetchDocumentError);
            });
          });
        });

        context('when website has an untrusted root certificate', () => {
          const untrustedRootSslUrl = 'https://untrusted-root.badssl.com/';

          it('throws a FetchDocumentError error', async () => {
            await expect(fetch({ url: untrustedRootSslUrl })).to.be.rejectedWith(FetchDocumentError);
          });

          context('with client script enabled', () => {
            it('throws a FetchDocumentError error', async () => {
              await expect(fetch({ url: untrustedRootSslUrl, executeClientScripts: true })).to.be.rejectedWith(FetchDocumentError);
            });
          });
        });
      });

      describe('when bot blocking is detected', () => {
        it('falls back to full DOM fetcher when bot blocking is detected', async () => {
          const { content, mimeType, fetcher } = await fetch({ url: `http://127.0.0.1:${SERVER_PORT}/block-once` });

          expect(content).to.equal(termsHTML);
          expect(mimeType).to.equal('text/html');
          expect(fetcher).to.equal(FETCHER_TYPES.FULL_DOM);
        });

        it('still throws FetchDocumentError if both fetchers fail', async () => {
          await expect(fetch({ url: `http://127.0.0.1:${SERVER_PORT}/always-block` })).to.be.rejectedWith(FetchDocumentError);
        });
      });
    });

    describe('Content stabilization', () => {
      context('with client script enabled and a stabilization delay', () => {
        it('forwards the stabilization delay to the full DOM fetcher', async () => {
          const { content } = await fetch({ url: `http://127.0.0.1:${SERVER_PORT}/progressive`, cssSelectors: '#list', executeClientScripts: true, config: { stabilizationDelay: 300 } });

          expect(content).to.match(/item3/);
        });
      });
    });
  });
});
