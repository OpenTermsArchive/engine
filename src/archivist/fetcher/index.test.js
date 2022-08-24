import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import fetch, { launchHeadlessBrowser, stopHeadlessBrowser, FetchDocumentError } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { expect } = chai;
const SERVER_PORT = 8976;

chai.use(chaiAsPromised);

const termsHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>First provider TOS</title></head><body><h1>Terms of service</h1><p>Dapibus quis diam sagittis</p></body></html>';

describe('Fetcher', function () {
  this.timeout(10000);

  before(launchHeadlessBrowser);

  after(stopHeadlessBrowser);

  describe('#fetch', () => {
    let temporaryServer;
    let expectedPDFContent;

    before(done => {
      temporaryServer = http.createServer((request, response) => {
        if (request.url === '/') {
          response.writeHead(200, { 'Content-Type': 'text/html' }).write(termsHTML);
        }
        if (request.url == '/404') {
          response.writeHead(404, { 'Content-Type': 'text/html' }).write('<!DOCTYPE html><html><body>404</body></html>');
        }
        if (request.url == '/terms.pdf') {
          expectedPDFContent = fs.readFileSync(path.resolve(__dirname, '../../../test/fixtures/terms.pdf'));

          response.writeHead(200, { 'Content-Type': 'application/pdf' }).write(expectedPDFContent);
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
        const url = `http://127.0.0.1:${SERVER_PORT}`;

        const EXISTING_SELECTORS = {
          String: 'body',
          'Array of strings': [ 'body', 'p' ],
          Range: { startBefore: 'p', endBefore: 'body' },
          'Array of ranges': [{ startBefore: 'p', endBefore: 'body' }],
          Mixed: [{ startBefore: 'h1', endBefore: 'body' }, 'p' ],
        };

        Object.entries(EXISTING_SELECTORS).forEach(([ name, existingSelectors ]) => {
          context(`when ${name} selectors are present`, () => {
            before(async () => {
              ({ content, mimeType } = await fetch({ url, cssSelectors: existingSelectors }));
            });

            it('returns the web page content of the given URL', async () => {
              expect(content).to.equal(termsHTML);
            });

            it('returns the MIME type of the given URL', async () => {
              expect(mimeType).to.equal('text/html');
            });

            context('with client script enabled', () => {
              before(async () => {
                ({ content, mimeType } = await fetch({ url, cssSelectors: existingSelectors, executeClientScripts: true }));
              });

              it('returns the web page content of the given URL', async () => {
                expect(content).to.equal(termsHTML);
              });

              it('returns the MIME type of the given URL', async () => {
                expect(mimeType).to.equal('text/html');
              });
            });
          });
        });

        const ABSENT_SELECTORS = {
          String: 'h2',
          'Array of strings': [ 'h2', 'p' ],
          Range: { startBefore: 'h2', endBefore: 'body' },
          'Array of ranges': [{ startBefore: 'h2', endBefore: 'body' }],
          Mixed: [{ startBefore: 'h2', endBefore: 'body' }, 'p' ],
        };

        Object.entries(ABSENT_SELECTORS).forEach(([ name, absentSelectors ]) => {
          context(`when ${name} selectors are not existing in the page`, () => {
            before(async () => {
              ({ content, mimeType } = await fetch({ url, cssSelectors: absentSelectors }));
            });

            it('returns the web page content of the given URL', async () => {
              expect(content).to.equal(termsHTML);
            });

            it('returns the MIME type of the given URL', async () => {
              expect(mimeType).to.equal('text/html');
            });

            context('with client script enabled', () => {
              before(async () => {
                ({ content, mimeType } = await fetch({ url, cssSelectors: absentSelectors, executeClientScripts: true }));
              });

              it('returns the web page content of the given URL', async () => {
                expect(content).to.equal(termsHTML);
              });

              it('returns the MIME type of the given URL', async () => {
                expect(mimeType).to.equal('text/html');
              });
            });
          });
        });
      });

      context('when url targets a PDF file', () => {
        let content;
        let mimeType;
        const pdfUrl = `http://127.0.0.1:${SERVER_PORT}/terms.pdf`;

        before(async () => {
          ({ content, mimeType } = await fetch({ url: pdfUrl }));
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
    });
  });
});
