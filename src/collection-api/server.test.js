import { expect } from 'chai';
import config from 'config';
import supertest from 'supertest';

import app from './server.js';

const basePath = config.get('@opentermsarchive/engine.collection-api.basePath');
const DOCS_PATH = `${basePath}/v1/docs/`; // The OpenAPI specification it serves is larger than the 1 kB under which responses are not compressed

const request = supertest(app);

describe('Collection API server', () => {
  describe('response compression', () => {
    context('when the client accepts gzip', () => {
      let response;

      before(async () => {
        response = await request.get(DOCS_PATH).set('Accept', 'application/json').set('Accept-Encoding', 'gzip');
      });

      it('compresses the response', () => {
        expect(response.headers['content-encoding']).to.equal('gzip');
      });

      it('serves the same content once decompressed', () => {
        expect(response.body).to.have.property('openapi');
      });
    });

    context('when the client requests a range of a file', () => {
      let response;

      before(async () => {
        response = await request.get(`${DOCS_PATH}swagger-ui-bundle.js`).set('Range', 'bytes=0-9999').set('Accept-Encoding', 'gzip').buffer(true)
          .parse((res, callback) => {
            const chunks = [];

            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => callback(null, Buffer.concat(chunks)));
          });
      });

      it('serves the range uncompressed, as its bounds count uncompressed bytes', () => {
        expect(response.status).to.equal(206);
        expect(response.headers).to.not.have.property('content-encoding');
        expect(response.body.length).to.equal(10000);
      });
    });

    context('when the client does not accept any compression', () => {
      let response;

      before(async () => {
        response = await request.get(DOCS_PATH).set('Accept', 'application/json').set('Accept-Encoding', 'identity');
      });

      it('does not compress the response', () => {
        expect(response.headers).to.not.have.property('content-encoding');
      });
    });
  });
});
