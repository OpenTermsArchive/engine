import chai from 'chai';
import config from 'config';
import supertest from 'supertest';

import RepositoryFactory from '../../archivist/recorder/repositories/factory.js';
import Version from '../../archivist/recorder/version.js';
import { toISODateWithoutMilliseconds } from '../../archivist/utils/date.js';
import app from '../server.js';

const basePath = config.get('@opentermsarchive/engine.collection-api.basePath');

const { expect } = chai;
const request = supertest(app);

describe('Versions API', () => {
  describe('GET /version/:serviceId/:termsType/:date', () => {
    let expectedResult;
    let versionsRepository;
    const FETCH_DATE = new Date('2023-01-01T12:00:00Z');
    const VERSION_COMMON_ATTRIBUTES = {
      serviceId: 'service-1',
      termsType: 'Terms of Service',
      snapshotId: ['snapshot_id'],
    };

    before(async () => {
      versionsRepository = RepositoryFactory.create(config.get('@opentermsarchive/engine.recorder.versions.storage'));

      await versionsRepository.initialize();

      const ONE_HOUR = 60 * 60 * 1000;

      await versionsRepository.save(new Version({
        ...VERSION_COMMON_ATTRIBUTES,
        content: 'initial content',
        fetchDate: new Date(new Date(FETCH_DATE).getTime() - ONE_HOUR),
      }));

      const version = new Version({
        ...VERSION_COMMON_ATTRIBUTES,
        content: 'updated content',
        fetchDate: FETCH_DATE,
      });

      await versionsRepository.save(version);

      await versionsRepository.save(new Version({
        ...VERSION_COMMON_ATTRIBUTES,
        content: 'latest content',
        fetchDate: new Date(new Date(FETCH_DATE).getTime() + ONE_HOUR),
      }));

      expectedResult = {
        id: version.id,
        fetchDate: toISODateWithoutMilliseconds(version.fetchDate),
        content: version.content,
      };
    });

    after(() => versionsRepository.removeAll());

    let response;

    context('when a version is found', () => {
      before(async () => {
        response = await request.get(`${basePath}/v1/version/service-1/Terms%20of%20Service/${encodeURIComponent(toISODateWithoutMilliseconds(FETCH_DATE))}`);
      });

      it('responds with 200 status code', () => {
        expect(response.status).to.equal(200);
      });

      it('responds with Content-Type application/json', () => {
        expect(response.type).to.equal('application/json');
      });

      it('returns the expected version', () => {
        expect(response.body).to.deep.equal(expectedResult);
      });
    });

    context('when the requested date is anterior to the first available version', () => {
      before(async () => {
        response = await request.get(`${basePath}/v1/version/service-1/Terms%20of%20Service/2000-01-01T12:00:00Z`);
      });

      it('responds with 404 status code', () => {
        expect(response.status).to.equal(404);
      });

      it('responds with Content-Type application/json', () => {
        expect(response.type).to.equal('application/json');
      });

      it('returns an error message', () => {
        expect(response.body.error).to.contain('No version found').and.to.contain('2000-01-01T12:00:00Z');
      });
    });

    context('when the requested date is in the future', () => {
      before(async () => {
        const dateInTheFuture = new Date(Date.now() + 60000); // 1 minute in the future

        response = await request.get(`${basePath}/v1/version/service-1/Terms%20of%20Service/${encodeURIComponent(toISODateWithoutMilliseconds(dateInTheFuture))}`);
      });

      it('responds with 416 status code', () => {
        expect(response.status).to.equal(416);
      });

      it('responds with Content-Type application/json', () => {
        expect(response.type).to.equal('application/json');
      });

      it('returns an error message', () => {
        expect(response.body.error).to.equal('Requested version is in the future');
      });
    });
  });
});
