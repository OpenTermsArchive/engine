import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import http from 'http';

import fetch from './fullDomFetcher.js';
import { InaccessibleContentError } from '../errors.js';

const { expect } = chai;
chai.use(chaiAsPromised);

const SERVER_PORT = 8976;

describe('FullDomFetcher', function () { // eslint-disable-line func-names
  this.timeout(10000);

  let termsHTML;
  let temporaryServer;

  before(done => {
    termsHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>First provider TOS</title></head><body><h1>Terms of service</h1><p>Dapibus quis diam sagittis</p></body></html>';

    temporaryServer = http.createServer((request, response) => {
      if (request.url == '/') {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.write(termsHTML);
        return response.end();
      }

      if (request.url == '/404') {
        response.writeHead(404, { 'Content-Type': 'text/html' });
        response.write('<!DOCTYPE html><html><body>404</body></html>');
        return response.end();
      }
    }).listen(SERVER_PORT);

    done();
  });

  describe('#fetch', () => {
    context('when web page is available', () => {
      let content;
      let mimeType;

      context('when expected elements are present', () => {
        before(async () => {
          const result = await fetch(`http://localhost:${SERVER_PORT}`, 'body');
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

      context('when expected elements are not present', () => {
        it('throws an InaccessibleContentError error', async () => {
          const NOT_PRESENT_SELECTOR = 'h2';
          await expect(fetch(`http://localhost:${SERVER_PORT}`, NOT_PRESENT_SELECTOR)).to.be.rejectedWith(InaccessibleContentError, /waiting for selector .* failed/);
        });
      });
    });

    context('when server is not resolved', () => {
      it('throws an InaccessibleContentError error', async () => {
        await expect(fetch('https://not.available.example', 'body')).to.be.rejectedWith(InaccessibleContentError, /ERR_NAME_NOT_RESOLVED/);
      });
    });

    context('when web page is not available', () => {
      it('throws an InaccessibleContentError error', async () => {
        await expect(fetch(`http://localhost:${SERVER_PORT}/404`, 'body')).to.be.rejectedWith(InaccessibleContentError, /404/);
      });
    });
  });

  after(() => {
    if (temporaryServer) {
      temporaryServer.close();
    }
  });
});
