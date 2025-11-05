import { expect } from 'chai';
import config from 'config';
import supertest from 'supertest';

import RepositoryFactory from '../../archivist/recorder/repositories/factory.js';
import Version from '../../archivist/recorder/version.js';
import { toISODateWithoutMilliseconds } from '../../archivist/utils/date.js';
import app from '../server.js';

const basePath = config.get('@opentermsarchive/engine.collection-api.basePath');

const request = supertest(app);

describe('Versions API', () => {
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
  });

  after(() => versionsRepository.removeAll());

  describe('GET /versions/:serviceId/:termsType', () => {
    let version1;
    let version2;
    let version3;

    before(async () => {
      const ONE_HOUR = 60 * 60 * 1000;

      version1 = new Version({
        ...VERSION_COMMON_ATTRIBUTES,
        content: 'initial content',
        fetchDate: new Date(new Date(FETCH_DATE).getTime() - ONE_HOUR),
      });
      await versionsRepository.save(version1);

      version2 = new Version({
        ...VERSION_COMMON_ATTRIBUTES,
        content: 'updated content',
        fetchDate: FETCH_DATE,
      });
      await versionsRepository.save(version2);

      version3 = new Version({
        ...VERSION_COMMON_ATTRIBUTES,
        content: 'latest content',
        fetchDate: new Date(new Date(FETCH_DATE).getTime() + ONE_HOUR),
      });
      await versionsRepository.save(version3);

      await versionsRepository.save(new Version({
        serviceId: 'service-2',
        termsType: 'Privacy Policy',
        snapshotId: ['snapshot_id'],
        content: 'other service content',
        fetchDate: FETCH_DATE,
      }));
    });

    let response;

    context('when versions are found', () => {
      before(async () => {
        response = await request.get(`${basePath}/v1/versions/service-1/Terms%20of%20Service`);
      });

      it('responds with 200 status code', () => {
        expect(response.status).to.equal(200);
      });

      it('responds with Content-Type application/json', () => {
        expect(response.type).to.equal('application/json');
      });

      it('returns response with metadata structure', () => {
        expect(response.body).to.have.all.keys('data', 'count', 'limit', 'offset');
      });

      it('returns all versions for the service and terms type', () => {
        expect(response.body.data).to.be.an('array').with.lengthOf(3);
      });

      it('returns correct count', () => {
        expect(response.body.count).to.equal(3);
      });

      it('returns versions with id, serviceId, termsType and fetchDate', () => {
        response.body.data.forEach(version => {
          expect(version).to.have.all.keys('id', 'serviceId', 'termsType', 'fetchDate');
          expect(version).to.not.have.property('content');
        });
      });

      it('returns versions with correct serviceId and termsType', () => {
        response.body.data.forEach(version => {
          expect(version.serviceId).to.equal('service-1');
          expect(version.termsType).to.equal('Terms of Service');
        });
      });

      it('returns versions in reverse chronological order', () => {
        expect(response.body.data[0].id).to.equal(version3.id);
        expect(response.body.data[1].id).to.equal(version2.id);
        expect(response.body.data[2].id).to.equal(version1.id);
      });

      it('returns versions with correct fetchDates', () => {
        expect(response.body.data[0].fetchDate).to.equal(toISODateWithoutMilliseconds(version3.fetchDate));
        expect(response.body.data[1].fetchDate).to.equal(toISODateWithoutMilliseconds(version2.fetchDate));
        expect(response.body.data[2].fetchDate).to.equal(toISODateWithoutMilliseconds(version1.fetchDate));
      });
    });

    context('with pagination', () => {
      context('with default limit (no query parameters)', () => {
        before(async () => {
          response = await request.get(`${basePath}/v1/versions/service-1/Terms%20of%20Service`);
        });

        it('responds with 200 status code', () => {
          expect(response.status).to.equal(200);
        });

        it('returns all versions when total is less than default limit', () => {
          expect(response.body.data).to.be.an('array').with.lengthOf(3);
        });

        it('includes default pagination metadata', () => {
          expect(response.body).to.have.property('limit', 100);
          expect(response.body).to.have.property('offset', 0);
        });
      });

      context('with limit parameter', () => {
        before(async () => {
          response = await request.get(`${basePath}/v1/versions/service-1/Terms%20of%20Service?limit=2`);
        });

        it('responds with 200 status code', () => {
          expect(response.status).to.equal(200);
        });

        it('returns limited number of versions', () => {
          expect(response.body.data).to.be.an('array').with.lengthOf(2);
        });

        it('returns correct total count', () => {
          expect(response.body.count).to.equal(3);
        });

        it('includes pagination metadata', () => {
          expect(response.body).to.have.property('limit', 2);
          expect(response.body).to.have.property('offset', 0);
        });

        it('returns first two versions in reverse chronological order', () => {
          expect(response.body.data[0].id).to.equal(version3.id);
          expect(response.body.data[1].id).to.equal(version2.id);
        });
      });

      context('with limit and offset parameters', () => {
        before(async () => {
          response = await request.get(`${basePath}/v1/versions/service-1/Terms%20of%20Service?limit=1&offset=1`);
        });

        it('responds with 200 status code', () => {
          expect(response.status).to.equal(200);
        });

        it('returns limited number of versions starting from offset', () => {
          expect(response.body.data).to.be.an('array').with.lengthOf(1);
        });

        it('returns correct total count', () => {
          expect(response.body.count).to.equal(3);
        });

        it('includes pagination metadata', () => {
          expect(response.body).to.have.property('limit', 1);
          expect(response.body).to.have.property('offset', 1);
        });

        it('returns second version', () => {
          expect(response.body.data[0].id).to.equal(version2.id);
        });
      });

      context('with only offset parameter', () => {
        before(async () => {
          response = await request.get(`${basePath}/v1/versions/service-1/Terms%20of%20Service?offset=1`);
        });

        it('responds with 200 status code', () => {
          expect(response.status).to.equal(200);
        });

        it('returns all versions starting from offset', () => {
          expect(response.body.data).to.be.an('array').with.lengthOf(2);
        });

        it('returns correct total count', () => {
          expect(response.body.count).to.equal(3);
        });

        it('includes offset in metadata', () => {
          expect(response.body).to.have.property('offset', 1);
        });

        it('returns last two versions', () => {
          expect(response.body.data[0].id).to.equal(version2.id);
          expect(response.body.data[1].id).to.equal(version1.id);
        });
      });

      context('with invalid limit parameter (too small)', () => {
        before(async () => {
          response = await request.get(`${basePath}/v1/versions/service-1/Terms%20of%20Service?limit=0`);
        });

        it('responds with 400 status code', () => {
          expect(response.status).to.equal(400);
        });

        it('returns error message', () => {
          expect(response.body).to.have.property('error');
          expect(response.body.error).to.include('Invalid limit parameter');
        });
      });

      context('with invalid limit parameter (exceeds maximum)', () => {
        before(async () => {
          response = await request.get(`${basePath}/v1/versions/service-1/Terms%20of%20Service?limit=501`);
        });

        it('responds with 400 status code', () => {
          expect(response.status).to.equal(400);
        });

        it('returns error message', () => {
          expect(response.body).to.have.property('error');
          expect(response.body.error).to.include('Invalid limit parameter');
          expect(response.body.error).to.include('500');
        });
      });

      context('with invalid offset parameter', () => {
        before(async () => {
          response = await request.get(`${basePath}/v1/versions/service-1/Terms%20of%20Service?offset=-1`);
        });

        it('responds with 400 status code', () => {
          expect(response.status).to.equal(400);
        });

        it('returns error message', () => {
          expect(response.body).to.have.property('error');
          expect(response.body.error).to.include('Invalid offset parameter');
        });
      });
    });

    context('when no versions are found', () => {
      before(async () => {
        response = await request.get(`${basePath}/v1/versions/non-existent-service/Terms%20of%20Service`);
      });

      it('responds with 404 status code', () => {
        expect(response.status).to.equal(404);
      });

      it('responds with Content-Type application/json', () => {
        expect(response.type).to.equal('application/json');
      });

      it('returns an error message', () => {
        expect(response.body.error).to.contain('No versions found').and.to.contain('non-existent-service').and.to.contain('Terms of Service');
      });
    });
  });

  describe('GET /version/:versionId', () => {
    const ONE_HOUR = 60 * 60 * 1000;
    let firstVersion;
    let middleVersion;
    let lastVersion;

    before(async () => {
      await versionsRepository.removeAll();

      firstVersion = new Version({
        ...VERSION_COMMON_ATTRIBUTES,
        content: 'first content',
        fetchDate: new Date(FETCH_DATE.getTime() - ONE_HOUR),
      });
      await versionsRepository.save(firstVersion);

      middleVersion = new Version({
        ...VERSION_COMMON_ATTRIBUTES,
        content: 'middle content',
        fetchDate: FETCH_DATE,
      });
      await versionsRepository.save(middleVersion);

      lastVersion = new Version({
        ...VERSION_COMMON_ATTRIBUTES,
        content: 'last content',
        fetchDate: new Date(FETCH_DATE.getTime() + ONE_HOUR),
      });
      await versionsRepository.save(lastVersion);
    });

    let response;

    context('when requesting the first version', () => {
      before(async () => {
        response = await request.get(`${basePath}/v1/version/${firstVersion.id}`);
      });

      it('responds with 200 status code', () => {
        expect(response.status).to.equal(200);
      });

      it('responds with Content-Type application/json', () => {
        expect(response.type).to.equal('application/json');
      });

      it('returns the version content and metadata', () => {
        expect(response.body.id).to.equal(firstVersion.id);
        expect(response.body.serviceId).to.equal(firstVersion.serviceId);
        expect(response.body.termsType).to.equal(firstVersion.termsType);
        expect(response.body.fetchDate).to.equal(toISODateWithoutMilliseconds(firstVersion.fetchDate));
        expect(response.body.content).to.equal(firstVersion.content);
      });

      it('returns links object', () => {
        expect(response.body.links).to.be.an('object');
      });

      it('returns first link pointing to itself', () => {
        expect(response.body.links.first).to.equal(firstVersion.id);
      });

      it('returns null for prev', () => {
        expect(response.body.links.prev).to.be.null;
      });

      it('returns next link', () => {
        expect(response.body.links.next).to.equal(middleVersion.id);
      });

      it('returns last link', () => {
        expect(response.body.links.last).to.equal(lastVersion.id);
      });
    });

    context('when requesting a middle version', () => {
      before(async () => {
        response = await request.get(`${basePath}/v1/version/${middleVersion.id}`);
      });

      it('responds with 200 status code', () => {
        expect(response.status).to.equal(200);
      });

      it('returns the version content and metadata', () => {
        expect(response.body.id).to.equal(middleVersion.id);
        expect(response.body.serviceId).to.equal(middleVersion.serviceId);
        expect(response.body.termsType).to.equal(middleVersion.termsType);
        expect(response.body.content).to.equal(middleVersion.content);
      });

      it('returns first link', () => {
        expect(response.body.links.first).to.equal(firstVersion.id);
      });

      it('returns prev link', () => {
        expect(response.body.links.prev).to.equal(firstVersion.id);
      });

      it('returns next link', () => {
        expect(response.body.links.next).to.equal(lastVersion.id);
      });

      it('returns last link', () => {
        expect(response.body.links.last).to.equal(lastVersion.id);
      });
    });

    context('when requesting the last version', () => {
      before(async () => {
        response = await request.get(`${basePath}/v1/version/${lastVersion.id}`);
      });

      it('responds with 200 status code', () => {
        expect(response.status).to.equal(200);
      });

      it('returns the version content and metadata', () => {
        expect(response.body.id).to.equal(lastVersion.id);
        expect(response.body.serviceId).to.equal(lastVersion.serviceId);
        expect(response.body.termsType).to.equal(lastVersion.termsType);
        expect(response.body.content).to.equal(lastVersion.content);
      });

      it('returns first link', () => {
        expect(response.body.links.first).to.equal(firstVersion.id);
      });

      it('returns prev link', () => {
        expect(response.body.links.prev).to.equal(middleVersion.id);
      });

      it('returns null for next', () => {
        expect(response.body.links.next).to.be.null;
      });

      it('returns last link pointing to itself', () => {
        expect(response.body.links.last).to.equal(lastVersion.id);
      });
    });

    context('when the version does not exist', () => {
      before(async () => {
        response = await request.get(`${basePath}/v1/version/non-existent-id`);
      });

      it('responds with 404 status code', () => {
        expect(response.status).to.equal(404);
      });

      it('responds with Content-Type application/json', () => {
        expect(response.type).to.equal('application/json');
      });

      it('returns an error message', () => {
        expect(response.body.error).to.contain('No version found').and.to.contain('non-existent-id');
      });
    });
  });

  describe('GET /version/:serviceId/:termsType/latest', () => {
    let firstVersion;
    let middleVersion;
    let lastVersion;

    before(async () => {
      await versionsRepository.removeAll();

      const ONE_HOUR = 60 * 60 * 1000;

      firstVersion = await versionsRepository.save(new Version({
        ...VERSION_COMMON_ATTRIBUTES,
        content: 'first content',
        fetchDate: new Date(FETCH_DATE.getTime() - ONE_HOUR),
      }));

      middleVersion = await versionsRepository.save(new Version({
        ...VERSION_COMMON_ATTRIBUTES,
        content: 'middle content',
        fetchDate: FETCH_DATE,
      }));

      lastVersion = await versionsRepository.save(new Version({
        ...VERSION_COMMON_ATTRIBUTES,
        content: 'last content',
        fetchDate: new Date(FETCH_DATE.getTime() + ONE_HOUR),
      }));
    });

    let response;

    context('when versions exist', () => {
      before(async () => {
        response = await request.get(`${basePath}/v1/version/service-1/Terms%20of%20Service/latest`);
      });

      it('responds with 200 status code', () => {
        expect(response.status).to.equal(200);
      });

      it('responds with Content-Type application/json', () => {
        expect(response.type).to.equal('application/json');
      });

      it('returns the latest version', () => {
        expect(response.body.id).to.equal(lastVersion.id);
        expect(response.body.serviceId).to.equal(lastVersion.serviceId);
        expect(response.body.termsType).to.equal(lastVersion.termsType);
        expect(response.body.content).to.equal(lastVersion.content);
        expect(response.body.fetchDate).to.equal(toISODateWithoutMilliseconds(lastVersion.fetchDate));
      });

      it('returns links object', () => {
        expect(response.body.links).to.be.an('object');
      });

      it('returns first link', () => {
        expect(response.body.links.first).to.equal(firstVersion.id);
      });

      it('returns prev link', () => {
        expect(response.body.links.prev).to.equal(middleVersion.id);
      });

      it('returns null for next', () => {
        expect(response.body.links.next).to.be.null;
      });

      it('returns last link pointing to itself', () => {
        expect(response.body.links.last).to.equal(lastVersion.id);
      });
    });

    context('when no versions exist', () => {
      before(async () => {
        response = await request.get(`${basePath}/v1/version/non-existent-service/Non%20Existent%20Terms/latest`);
      });

      it('responds with 404 status code', () => {
        expect(response.status).to.equal(404);
      });

      it('responds with Content-Type application/json', () => {
        expect(response.type).to.equal('application/json');
      });

      it('returns an error message', () => {
        expect(response.body.error).to.contain('No version found').and.to.contain('non-existent-service');
      });
    });
  });

  describe('GET /version/:serviceId/:termsType/:date', () => {
    let expectedResult;
    let firstVersion;
    let middleVersion;
    let lastVersion;

    before(async () => {
      await versionsRepository.removeAll();

      const ONE_HOUR = 60 * 60 * 1000;

      firstVersion = await versionsRepository.save(new Version({
        ...VERSION_COMMON_ATTRIBUTES,
        content: 'initial content',
        fetchDate: new Date(new Date(FETCH_DATE).getTime() - ONE_HOUR),
      }));

      middleVersion = await versionsRepository.save(new Version({
        ...VERSION_COMMON_ATTRIBUTES,
        content: 'updated content',
        fetchDate: FETCH_DATE,
      }));

      lastVersion = await versionsRepository.save(new Version({
        ...VERSION_COMMON_ATTRIBUTES,
        content: 'latest content',
        fetchDate: new Date(new Date(FETCH_DATE).getTime() + ONE_HOUR),
      }));

      expectedResult = {
        id: middleVersion.id,
        serviceId: middleVersion.serviceId,
        termsType: middleVersion.termsType,
        fetchDate: toISODateWithoutMilliseconds(middleVersion.fetchDate),
        content: middleVersion.content,
        links: {
          first: firstVersion.id,
          prev: firstVersion.id,
          next: lastVersion.id,
          last: lastVersion.id,
        },
      };
    });

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
