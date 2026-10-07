import { expect } from 'chai';
import config from 'config';
import supertest from 'supertest';

import TrackingResultsRepository from '../../archivist/tracking-results/repository.js';
import { COMPLETED_RUN_MESSAGE_PREFIX, RUN_ID_TRAILER_KEY } from '../../archivist/tracking-results/run/dataMapper.js';
import Run from '../../archivist/tracking-results/run/index.js';
import TermsResult, { STATUSES } from '../../archivist/tracking-results/terms-result/index.js';
import app from '../server.js';

const basePath = config.get('@opentermsarchive/engine.collection-api.basePath');

const request = supertest(app);

const COMPLETED_RUN_ID = 'ota-run-11111111-58cc-4372-a567-0e02b2c3d479';
const IN_PROGRESS_RUN_ID = 'ota-run-22222222-58cc-4372-a567-0e02b2c3d479';

const SOURCE_DOCUMENTS = [{
  id: 'main',
  fetch: 'https://www.facebook.com/legal/terms',
  select: '.content',
  filter: [],
  executeClientScripts: false,
  mimeType: 'text/html',
  snapshotId: 'def456',
}];

function makeResult({ serviceId, termsType, status = STATUSES.ok, reasons }) {
  const event = { date: '2026-01-10T10:30:00Z', serviceName: serviceId, sourceDocuments: SOURCE_DOCUMENTS };

  if (reasons) {
    event.reasons = reasons;
  }

  return new TermsResult({ serviceId, termsType, status, event });
}

function makeRun(runId) {
  return new Run({
    runId,
    collectionId: 'test',
    schedule: '30 */12 * * *',
    startDate: '2026-04-06T10:30:00Z',
    engineVersion: '16.0.0',
    declarationsCommit: 'abc123def456',
    servicesCount: 2,
    termsCount: 3,
  });
}

describe('Tracking results API', () => {
  let repository;

  before(async () => {
    repository = await new TrackingResultsRepository(config.get('@opentermsarchive/engine.tracking-results.storage.git')).initialize();
  });

  after(() => repository.removeAll());

  context('when no tracking run has completed yet', () => {
    before(() => repository.saveRun(makeRun(COMPLETED_RUN_ID)));

    after(() => repository.removeAll());

    describe('GET /tracking-results', () => {
      let response;

      before(async () => {
        response = await request.get(`${basePath}/v1/tracking-results`);
      });

      it('responds with 200 status code', () => {
        expect(response.status).to.equal(200);
      });

      it('returns an empty list', () => {
        expect(response.body).to.deep.equal({ runId: null, data: [], count: 0, limit: 100, offset: 0 });
      });
    });

    describe('GET /tracking-results/run', () => {
      let response;

      before(async () => {
        response = await request.get(`${basePath}/v1/tracking-results/run`);
      });

      it('responds with 404 status code', () => {
        expect(response.status).to.equal(404);
      });

      it('returns an error message', () => {
        expect(response.body.error).to.equal('No tracking run has completed yet');
      });
    });

    describe('GET /tracking-result/:serviceId/:termsType', () => {
      it('responds with 404 status code', async () => {
        const response = await request.get(`${basePath}/v1/tracking-result/Facebook/Terms%20of%20Service`);

        expect(response.status).to.equal(404);
      });
    });
  });

  context('when a run completed and the next one is in progress', () => {
    before(async () => {
      await repository.saveRun(makeRun(COMPLETED_RUN_ID));
      await repository.saveTermsResult(makeResult({ serviceId: 'Facebook', termsType: 'Terms of Service' }));
      await repository.saveTermsResult(makeResult({ serviceId: 'Facebook', termsType: 'Privacy Policy', status: STATUSES.failed, reasons: ['[fetch] HTTP code 404'] }));
      await repository.saveTermsResult(makeResult({ serviceId: 'Google', termsType: 'Terms of Service' }));

      const completedRun = makeRun(COMPLETED_RUN_ID);

      completedRun.tracked = { ok: 2, failed: 1 };
      completedRun.coverage.processed = 3;
      completedRun.markCompleted('2026-04-06T10:42:34Z');
      await repository.saveRun(completedRun);

      await repository.saveRun(makeRun(IN_PROGRESS_RUN_ID));
      await repository.saveTermsResult(makeResult({ serviceId: 'Facebook', termsType: 'Terms of Service', status: STATUSES.failed, reasons: ['[extraction] CSS selector ".content" has no match in the document'] }));
      await repository.saveTermsResult(makeResult({ serviceId: 'Google', termsType: 'Privacy Policy' }));
    });

    after(() => repository.removeAll());

    describe('GET /tracking-results', () => {
      let response;

      before(async () => {
        response = await request.get(`${basePath}/v1/tracking-results`);
      });

      it('responds with 200 status code', () => {
        expect(response.status).to.equal(200);
      });

      it('responds with Content-Type application/json', () => {
        expect(response.type).to.equal('application/json');
      });

      it('returns the tracking results recorded by the completed run', () => {
        expect(response.body.data.map(({ serviceId, termsType, status }) => ({ serviceId, termsType, status }))).to.deep.equal([
          { serviceId: 'Facebook', termsType: 'Privacy Policy', status: 'failed' },
          { serviceId: 'Facebook', termsType: 'Terms of Service', status: 'ok' },
          { serviceId: 'Google', termsType: 'Terms of Service', status: 'ok' },
        ]);
      });

      it('returns the event of each tracking result', () => {
        expect(response.body.data[0].event).to.deep.equal({
          date: '2026-01-10T10:30:00Z',
          serviceName: 'Facebook',
          sourceDocuments: SOURCE_DOCUMENTS,
          reasons: ['[fetch] HTTP code 404'],
        });
      });

      it('returns pagination metadata', () => {
        expect(response.body).to.include({ count: 3, limit: 100, offset: 0 });
      });

      it('identifies the completed run the list reflects', () => {
        expect(response.body.runId).to.equal(COMPLETED_RUN_ID);
      });

      context('with a status filter', () => {
        before(async () => {
          response = await request.get(`${basePath}/v1/tracking-results?status=failed`);
        });

        it('returns only the tracking results with this status', () => {
          expect(response.body.data.map(({ serviceId, termsType }) => ({ serviceId, termsType }))).to.deep.equal([{ serviceId: 'Facebook', termsType: 'Privacy Policy' }]);
        });

        it('counts only the tracking results with this status', () => {
          expect(response.body.count).to.equal(1);
        });
      });

      context('with an invalid status filter', () => {
        before(async () => {
          response = await request.get(`${basePath}/v1/tracking-results?status=crashed`);
        });

        it('responds with 400 status code', () => {
          expect(response.status).to.equal(400);
        });

        it('returns an error message', () => {
          expect(response.body.error).to.equal('Invalid status parameter. Must be one of "ok", "failed".');
        });
      });

      context('with pagination parameters', () => {
        before(async () => {
          response = await request.get(`${basePath}/v1/tracking-results?limit=1&offset=1`);
        });

        it('returns the requested page', () => {
          expect(response.body.data.map(({ serviceId, termsType }) => ({ serviceId, termsType }))).to.deep.equal([{ serviceId: 'Facebook', termsType: 'Terms of Service' }]);
        });

        it('counts all the tracking results', () => {
          expect(response.body).to.include({ count: 3, limit: 1, offset: 1 });
        });
      });

      context('with invalid pagination parameters', () => {
        before(async () => {
          response = await request.get(`${basePath}/v1/tracking-results?limit=0`);
        });

        it('responds with 400 status code', () => {
          expect(response.status).to.equal(400);
        });
      });
    });

    describe('GET /tracking-results/run', () => {
      let response;

      before(async () => {
        response = await request.get(`${basePath}/v1/tracking-results/run`);
      });

      it('responds with 200 status code', () => {
        expect(response.status).to.equal(200);
      });

      it('returns the completed run rather than the one in progress', () => {
        expect(response.body).to.include({ runId: COMPLETED_RUN_ID });
        expect(response.body.lastRun).to.deep.equal({ startDate: '2026-04-06T10:30:00Z', endDate: '2026-04-06T10:42:34Z', engineVersion: '16.0.0', status: 'completed' });
      });

      it('returns the content of the run', () => {
        expect(response.body).to.deep.include({
          collectionId: 'test',
          schedule: '30 */12 * * *',
          declarations: { commit: 'abc123def456', services: 2, terms: 3 },
          tracked: { ok: 2, failed: 1 },
          coverage: { processed: 3, skipped: [] },
        });
      });
    });

    describe('GET /tracking-result/:serviceId', () => {
      let response;

      context('when the service has tracking results', () => {
        before(async () => {
          response = await request.get(`${basePath}/v1/tracking-result/Facebook`);
        });

        it('responds with 200 status code', () => {
          expect(response.status).to.equal(200);
        });

        it('returns the tracking results of the service recorded by the completed run', () => {
          expect(response.body.data.map(({ termsType, status }) => ({ termsType, status }))).to.deep.equal([
            { termsType: 'Privacy Policy', status: 'failed' },
            { termsType: 'Terms of Service', status: 'ok' },
          ]);
        });

        it('returns pagination metadata', () => {
          expect(response.body).to.include({ count: 2, limit: 100, offset: 0 });
        });

        it('identifies the completed run the list reflects', () => {
          expect(response.body.runId).to.equal(COMPLETED_RUN_ID);
        });
      });

      context('when the service has no tracking results', () => {
        before(async () => {
          response = await request.get(`${basePath}/v1/tracking-result/Unknown`);
        });

        it('responds with 404 status code', () => {
          expect(response.status).to.equal(404);
        });

        it('returns an error message', () => {
          expect(response.body.error).to.equal('No tracking results found for service "Unknown"');
        });
      });
    });

    describe('GET /tracking-result/:serviceId/:termsType', () => {
      let response;

      context('when the terms have a tracking result', () => {
        before(async () => {
          response = await request.get(`${basePath}/v1/tracking-result/Facebook/Terms%20of%20Service`);
        });

        it('responds with 200 status code', () => {
          expect(response.status).to.equal(200);
        });

        it('returns the tracking result recorded by the completed run', () => {
          expect(response.body).to.deep.equal({
            serviceId: 'Facebook',
            termsType: 'Terms of Service',
            declared: false,
            status: 'ok',
            event: {
              date: '2026-01-10T10:30:00Z',
              serviceName: 'Facebook',
              sourceDocuments: SOURCE_DOCUMENTS,
            },
          });
        });
      });

      context('when the terms were first tracked by the run in progress', () => {
        before(async () => {
          response = await request.get(`${basePath}/v1/tracking-result/Google/Privacy%20Policy`);
        });

        it('responds with 404 status code', () => {
          expect(response.status).to.equal(404);
        });

        it('returns an error message', () => {
          expect(response.body.error).to.equal('No tracking result found for service "Google" and terms type "Privacy Policy"');
        });
      });

      context('when the identifiers cannot name a tracking result', () => {
        before(async () => {
          response = await request.get(`${basePath}/v1/tracking-result/Facebook%2F..%2F..%2F/run`);
        });

        it('responds with 404 status code', () => {
          expect(response.status).to.equal(404);
        });

        it('returns an error message', () => {
          expect(response.body.error).to.equal('No tracking result found for service "Facebook/../../" and terms type "run"');
        });
      });
    });
  });

  context('when the terms of a tracking result are no longer declared', () => { // The test collection declares service·A but not Facebook
    before(async () => {
      await repository.saveRun(makeRun(COMPLETED_RUN_ID));
      await repository.saveTermsResult(makeResult({ serviceId: 'service·A', termsType: 'Terms of Service' }));
      await repository.saveTermsResult(makeResult({ serviceId: 'Facebook', termsType: 'Terms of Service' }));

      const completedRun = makeRun(COMPLETED_RUN_ID);

      completedRun.markCompleted('2026-04-06T10:42:34Z');
      await repository.saveRun(completedRun);
    });

    after(() => repository.removeAll());

    describe('GET /tracking-results', () => {
      it('tells whether the terms of each tracking result are still declared', async () => {
        const response = await request.get(`${basePath}/v1/tracking-results`);

        expect(response.body.data.map(({ serviceId, termsType, declared }) => ({ serviceId, termsType, declared }))).to.deep.equal([
          { serviceId: 'Facebook', termsType: 'Terms of Service', declared: false },
          { serviceId: 'service·A', termsType: 'Terms of Service', declared: true },
        ]);
      });
    });

    describe('GET /tracking-result/:serviceId', () => {
      it('marks the tracking results of declared terms as declared', async () => {
        const response = await request.get(`${basePath}/v1/tracking-result/${encodeURIComponent('service·A')}`);

        expect(response.body.data[0].declared).to.be.true;
      });

      it('marks the tracking results of terms no longer declared as not declared', async () => {
        const response = await request.get(`${basePath}/v1/tracking-result/Facebook`);

        expect(response.body.data[0].declared).to.be.false;
      });
    });

    describe('GET /tracking-result/:serviceId/:termsType', () => {
      it('marks the tracking result of declared terms as declared', async () => {
        const response = await request.get(`${basePath}/v1/tracking-result/${encodeURIComponent('service·A')}/Terms%20of%20Service`);

        expect(response.body.declared).to.be.true;
      });

      it('marks the tracking result of terms no longer declared as not declared', async () => {
        const response = await request.get(`${basePath}/v1/tracking-result/Facebook/Terms%20of%20Service`);

        expect(response.body.declared).to.be.false;
      });
    });
  });

  context('when a tracking result recorded by the completed run cannot be read', () => {
    let response;

    before(async () => {
      await repository.saveRun(makeRun(COMPLETED_RUN_ID));
      await repository.commit({ filePath: 'Facebook/Terms of Service.json', content: '{ broken json', message: 'Corrupt result' });

      const completedRun = makeRun(COMPLETED_RUN_ID);

      completedRun.markCompleted('2026-04-06T10:42:34Z');
      await repository.saveRun(completedRun);

      response = await request.get(`${basePath}/v1/tracking-results`);
    });

    after(() => repository.removeAll());

    it('responds with 500 status code', () => {
      expect(response.status).to.equal(500);
    });

    it('responds with Content-Type application/json', () => {
      expect(response.type).to.equal('application/json');
    });

    it('returns a generic error message', () => {
      expect(response.body).to.deep.equal({ error: 'Internal Server Error' });
    });
  });

  context('when a run completes between two pages', () => {
    const NEXT_RUN_ID = 'ota-run-33333333-58cc-4372-a567-0e02b2c3d479';
    let firstPage;
    let secondPage;

    async function completeRun(runId, results) {
      await repository.saveRun(makeRun(runId));

      for (const result of results) {
        await repository.saveTermsResult(result);
      }

      const run = makeRun(runId);

      run.markCompleted('2026-04-06T10:42:34Z');
      await repository.saveRun(run);
    }

    before(async () => {
      await completeRun(COMPLETED_RUN_ID, [ makeResult({ serviceId: 'Facebook', termsType: 'Terms of Service' }), makeResult({ serviceId: 'Google', termsType: 'Terms of Service' }) ]);
      firstPage = (await request.get(`${basePath}/v1/tracking-results?limit=1&offset=0`)).body;
      await completeRun(NEXT_RUN_ID, [makeResult({ serviceId: 'Google', termsType: 'Privacy Policy' })]);
      secondPage = (await request.get(`${basePath}/v1/tracking-results?limit=1&offset=1`)).body;
    });

    after(() => repository.removeAll());

    it('serves the first page as of the run completed at the time', () => {
      expect(firstPage).to.include({ runId: COMPLETED_RUN_ID, count: 2 });
    });

    it('serves the second page as of the run that completed meanwhile, which its run ID reveals', () => {
      expect(secondPage).to.include({ runId: NEXT_RUN_ID, count: 3 });
    });
  });

  context('when the run file of the completed run cannot be read', () => { // The lists only need the run ID, which the completion commit carries as a trailer
    let listResponse;
    let runResponse;

    before(async () => {
      await repository.saveRun(makeRun(COMPLETED_RUN_ID));
      await repository.saveTermsResult(makeResult({ serviceId: 'Facebook', termsType: 'Terms of Service' }));
      await repository.commit({ filePath: 'run.json', content: '{ broken json', message: `${COMPLETED_RUN_MESSAGE_PREFIX}ota-run-11111111 (1 ok, 0 failed)`, trailers: { [RUN_ID_TRAILER_KEY]: COMPLETED_RUN_ID } });

      listResponse = await request.get(`${basePath}/v1/tracking-results`);
      runResponse = await request.get(`${basePath}/v1/tracking-results/run`);
    });

    after(() => repository.removeAll());

    it('still serves the tracking results with their run ID', () => {
      expect(listResponse.status).to.equal(200);
      expect(listResponse.body).to.include({ runId: COMPLETED_RUN_ID, count: 1 });
    });

    it('fails to serve the run itself', () => {
      expect(runResponse.status).to.equal(500);
    });
  });
});
