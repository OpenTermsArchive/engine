import { expect } from 'chai';
import config from 'config';
import request from 'supertest';

import app from '../server.js';

const basePath = config.get('api.basePath');

describe('Docs API', () => {
  describe('GET /docs', () => {
    let response;

    context('when requested as JSON', () => {
      before(async () => {
        response = await request(app).get(`${basePath}/v1/docs/`).set('Accept', 'application/json');
      });

      it('responds with 200 status code', () => {
        expect(response.status).to.equal(200);
      });

      it('responds with Content-Type application/json', () => {
        expect(response.type).to.equal('application/json');
      });

      describe('body response defines', () => {
        let subject;

        before(async () => {
          subject = response.body;
        });

        it('OpenAPI version', () => {
          expect(subject).to.have.property('openapi');
        });

        it('paths', () => {
          expect(subject).to.have.property('paths');
        });

        describe('with endpoints', () => {
          before(async () => {
            subject = response.body.paths;
          });

          it('/services', () => {
            expect(subject).to.have.property('/services');
          });

          it('/service/{serviceId}', () => {
            expect(subject).to.have.property('/service/{serviceId}');
          });

          it('/version/{serviceId}/{termsType}/{date}', () => {
            expect(subject).to.have.property('/version/{serviceId}/{termsType}/{date}');
          });
        });
      });
    });

    context('when requested as HTML', () => {
      before(async () => {
        response = await request(app).get(`${basePath}/v1/docs/`);
      });

      it('responds with 200 status code', () => {
        expect(response.status).to.equal(200);
      });

      it('responds with Content-Type text/html', () => {
        expect(response.type).to.equal('text/html');
      });
    });
  });
});
