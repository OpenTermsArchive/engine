import http from 'http';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import fetch, { launchHeadlessBrowser, stopHeadlessBrowser, FetchDocumentError } from './index.js';

const { expect } = chai;
const SERVER_PORT = 8976;

chai.use(chaiAsPromised);

describe('Fetcher', function () {
  this.timeout(5000);

  before(launchHeadlessBrowser);

  after(stopHeadlessBrowser);

  describe('#fetch', () => {
    describe('Error handling', () => {
      let temporaryServer;

      before(done => {
        temporaryServer = http
          .createServer((request, response) => {
            if (request.url == '/404') {
              response.writeHead(404, { 'Content-Type': 'text/html' });
              response.write('<!DOCTYPE html><html><body>404</body></html>');

              return response.end();
            }
          })
          .listen(SERVER_PORT);

        done();
      });

      after(() => {
        if (temporaryServer) {
          temporaryServer.close();
        }
      });

      context('when web page is not available', () => {
        it('throws a FetchDocumentError error', async () => {
          await expect(fetch({ url: `http://localhost:${SERVER_PORT}/404` })).to.be.rejectedWith(FetchDocumentError, /404/);
        });

        context('with client script enabled', () => {
          it('throws a FetchDocumentError error', async () => {
            await expect(fetch({
              url: `http://localhost:${SERVER_PORT}/404`,
              executeClientScripts: true,
              cssSelectors: 'body',
            })).to.be.rejectedWith(FetchDocumentError, /404/);
          });
        });
      });

      context('when server is not resolved', () => {
        it('throws a FetchDocumentError error', async () => {
          await expect(fetch({ url: 'https://not.available.example' })).to.be.rejectedWith(FetchDocumentError);
        });

        context('with client script enabled', () => {
          it('throws a FetchDocumentError error', async () => {
            await expect(fetch({ url: 'https://not.available.example', executeClientScripts: true })).to.be.rejectedWith(FetchDocumentError);
          });
        });
      });

      describe('When there is a certificate error', () => {
        context('when website has a self signed certificate', () => {
          it('throws a FetchDocumentError error', async () => {
            await expect(fetch({ url: 'https://self-signed.badssl.com/' })).to.be.rejectedWith(FetchDocumentError);
          });
        });

        context('when website has an expired certificate', () => {
          it('throws a FetchDocumentError error', async () => {
            await expect(fetch({ url: 'https://expired.badssl.com/' })).to.be.rejectedWith(FetchDocumentError);
          });
        });

        context('when website has an untrusted root certificate', () => {
          it('throws a FetchDocumentError error', async () => {
            await expect(fetch({ url: 'https://untrusted-root.badssl.com/' })).to.be.rejectedWith(FetchDocumentError);
          });
        });

        context('with client script enabled', () => {
          context('when website has a self signed certificate', () => {
            it('throws a FetchDocumentError error', async () => {
              await expect(fetch({ url: 'https://self-signed.badssl.com/', executeClientScripts: true })).to.be.rejectedWith(FetchDocumentError);
            });
          });

          context('when website has an expired certificate', () => {
            it('throws a FetchDocumentError error', async () => {
              await expect(fetch({ url: 'https://expired.badssl.com/', executeClientScripts: true })).to.be.rejectedWith(FetchDocumentError);
            });
          });

          context('when website has an untrusted root certificate', () => {
            it('throws a FetchDocumentError error', async () => {
              await expect(fetch({ url: 'https://untrusted-root.badssl.com/', executeClientScripts: true })).to.be.rejectedWith(FetchDocumentError);
            });
          });
        });
      });
    });
  });
});
