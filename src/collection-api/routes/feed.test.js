import { expect } from 'chai';
import config from 'config';
import supertest from 'supertest';

import { getCollection } from '../../archivist/collection/index.js';
import RepositoryFactory from '../../archivist/recorder/repositories/factory.js';
import Version from '../../archivist/recorder/version.js';
import { toISODateWithoutMilliseconds } from '../../archivist/utils/date.js';
import app from '../server.js';

const basePath = config.get('@opentermsarchive/engine.collection-api.basePath');
const request = supertest(app);
const storageConfig = config.get('@opentermsarchive/engine.recorder.versions.storage');

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));

  return match ? match[1] : null;
}

describe('Feed API', () => {
  describe('GET /feed', () => {
    let response;
    let collection;

    before(async () => {
      collection = await getCollection();
      response = await request.get(`${basePath}/v1/feed`);
    });

    it('responds with 200 status code', () => {
      expect(response.status).to.equal(200);
    });

    it('responds with Content-Type application/atom+xml', () => {
      expect(response.headers['content-type']).to.match(/^application\/atom\+xml/);
    });

    it('is a valid Atom feed root', () => {
      expect(response.text).to.match(/^<\?xml version="1\.0"/);
      expect(response.text).to.include('<feed');
      expect(response.text).to.include('xmlns="http://www.w3.org/2005/Atom"');
    });

    describe('feed-level metadata', () => {
      it('has a title matching the collection name', () => {
        expect(extractTag(response.text, 'title')).to.equal(collection.metadata.name);
      });

      it('has a subtitle matching the collection tagline', () => {
        expect(extractTag(response.text, 'subtitle')).to.equal(collection.metadata.tagline);
      });

      it('has a tag URI id based on the collection id', () => {
        expect(extractTag(response.text, 'id')).to.equal(`tag:opentermsarchive.org,2026:feed:${collection.metadata.id}`);
      });

      it('has an updated element with a valid ISO 8601 datetime', () => {
        const updated = extractTag(response.text, 'updated');

        expect(updated).to.be.a('string');
        expect(new Date(updated).toString()).to.not.equal('Invalid Date');
      });

      it('has a self link pointing to the feed endpoint', () => {
        const selfHrefMatch = response.text.match(/<link[^>]*rel="self"[^>]*href="([^"]+)"/);

        expect(selfHrefMatch).to.not.be.null;
        expect(selfHrefMatch[1]).to.match(new RegExp(`${basePath}/v1/feed$`));
      });

      it('has an author named OTA-Bot', () => {
        expect(response.text).to.match(/<author>[\s\S]*<name>OTA-Bot<\/name>[\s\S]*<\/author>/);
      });

      it('has a logo matching the collection logo', () => {
        expect(extractTag(response.text, 'logo')).to.equal(collection.metadata.logo);
      });
    });
  });

  describe('GET /feed — entries', () => {
    const FETCH_DATE_FIRST = new Date('2023-01-01T12:00:00Z');
    const FETCH_DATE_CHANGE = new Date('2023-06-15T08:30:00Z');
    const FETCH_DATE_UPGRADE = new Date('2024-02-10T16:45:00Z');

    let response;
    let repository;
    let savedVersions;

    before(async function () {
      this.timeout(5000);
      repository = RepositoryFactory.create(storageConfig);
      await repository.initialize();

      const firstRecord = await repository.save(new Version({
        serviceId: 'service-1',
        termsType: 'Terms of Service',
        content: 'first content',
        fetchDate: FETCH_DATE_FIRST,
        snapshotIds: ['snapshot_1'],
      }));

      const changeRecord = await repository.save(new Version({
        serviceId: 'service-1',
        termsType: 'Terms of Service',
        content: 'changed content',
        fetchDate: FETCH_DATE_CHANGE,
        snapshotIds: ['snapshot_2'],
      }));

      const upgradeRecord = await repository.save(new Version({
        serviceId: 'service-2',
        termsType: 'Privacy Policy',
        content: 'initial privacy',
        fetchDate: new Date('2024-01-01T00:00:00Z'),
        snapshotIds: ['snapshot_3'],
      }));

      const technicalUpgradeRecord = await repository.save(new Version({
        serviceId: 'service-2',
        termsType: 'Privacy Policy',
        content: 'upgraded privacy',
        fetchDate: FETCH_DATE_UPGRADE,
        snapshotIds: ['snapshot_4'],
        isTechnicalUpgrade: true,
      }));

      savedVersions = { firstRecord, changeRecord, upgradeRecord, technicalUpgradeRecord };
      response = await request.get(`${basePath}/v1/feed`);
    });

    after(() => repository.removeAll());

    it('orders entries newest-first', () => {
      const updates = [...response.text.matchAll(/<entry>[\s\S]*?<updated>([^<]+)<\/updated>[\s\S]*?<\/entry>/g)].map(match => match[1]);

      expect(updates).to.deep.equal([...updates].sort().reverse());
    });

    describe('entry metadata', () => {
      let firstEntry;

      before(() => {
        firstEntry = response.text.match(/<entry>[\s\S]*?<\/entry>/)[0];
      });

      it('has an id tag URI including storage type and record id', () => {
        const collectionId = 'test';
        const expected = `tag:opentermsarchive.org,2026:version:${collectionId}:${storageConfig.type}:${savedVersions.technicalUpgradeRecord.id}`;

        expect(firstEntry).to.include(`<id>${expected}</id>`);
      });

      it('has an alternate link to the version API endpoint', () => {
        const href = firstEntry.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/)[1];
        const expectedPathFragment = `/version/${encodeURIComponent('service-2')}/${encodeURIComponent('Privacy Policy')}/${encodeURIComponent(toISODateWithoutMilliseconds(FETCH_DATE_UPGRADE))}`;

        expect(href).to.include(expectedPathFragment);
      });

      it('has a type="text/html" on the alternate link', () => {
        expect(firstEntry).to.match(/<link[^>]*rel="alternate"[^>]*type="text\/html"/);
      });

      it('has a title reconstructed from commit prefix + serviceId + termsType', () => {
        const title = firstEntry.match(/<title[^>]*>([\s\S]*?)<\/title>/)[1];

        expect(title).to.include('Apply technical or declaration upgrade on');
        expect(title).to.include('service-2');
        expect(title).to.include('Privacy Policy');
      });

      it('has an updated element matching the fetch date', () => {
        const updated = firstEntry.match(/<updated>([^<]+)<\/updated>/)[1];

        expect(new Date(updated).toISOString()).to.equal(FETCH_DATE_UPGRADE.toISOString());
      });

      it('has three categories with the expected schemes', () => {
        const categories = [...firstEntry.matchAll(/<category([^/]*)\/>/g)].map(match => match[1]);

        expect(categories).to.have.length(3);

        const schemes = categories.map(attrs => attrs.match(/scheme="([^"]+)"/)[1]);

        expect(schemes).to.include('tag:opentermsarchive.org,2026:scheme:service');
        expect(schemes).to.include('tag:opentermsarchive.org,2026:scheme:terms-type');
        expect(schemes).to.include('tag:opentermsarchive.org,2026:scheme:record-type');
      });

      it('has category terms for service, terms type and record type', () => {
        const categories = [...firstEntry.matchAll(/<category([^/]*)\/>/g)].map(match => match[1]);
        const terms = categories.map(attrs => attrs.match(/term="([^"]+)"/)[1]);

        expect(terms).to.include('service-2');
        expect(terms).to.include('Privacy Policy');
        expect(terms).to.include('Technical upgrade');
      });
    });

    describe('record-type classification', () => {
      function findEntryById(xml, recordId) {
        const match = [...xml.matchAll(/<entry>[\s\S]*?<\/entry>/g)].find(entry => entry[0].includes(`:${recordId}</id>`));

        return match && match[0];
      }

      it('classifies a first record as "First record"', () => {
        const entry = findEntryById(response.text, savedVersions.upgradeRecord.id);

        expect(entry).to.not.be.undefined;
        expect(entry).to.match(/term="First record"/);
      });

      it('classifies a content change as "Change"', () => {
        const entry = findEntryById(response.text, savedVersions.changeRecord.id);

        expect(entry).to.not.be.undefined;
        expect(entry).to.match(/term="Change"/);
      });

      it('classifies a technical upgrade as "Technical upgrade"', () => {
        const entry = findEntryById(response.text, savedVersions.technicalUpgradeRecord.id);

        expect(entry).to.not.be.undefined;
        expect(entry).to.match(/term="Technical upgrade"/);
      });
    });
  });

  describe('GET /feed/:serviceId', () => {
    const SERVICE = 'service_without_history';
    const OTHER_SERVICE = 'service_with_history';
    const TERMS = 'Terms of Service';

    let repository;

    before(async function () {
      this.timeout(5000);
      repository = RepositoryFactory.create(storageConfig);
      await repository.initialize();

      await repository.save(new Version({
        serviceId: SERVICE,
        termsType: TERMS,
        content: 'c1',
        fetchDate: new Date('2024-01-01T00:00:00Z'),
        snapshotIds: ['s1'],
      }));
      await repository.save(new Version({
        serviceId: SERVICE,
        termsType: TERMS,
        content: 'c2',
        fetchDate: new Date('2024-02-01T00:00:00Z'),
        snapshotIds: ['s2'],
      }));
      await repository.save(new Version({
        serviceId: OTHER_SERVICE,
        termsType: TERMS,
        content: 'c3',
        fetchDate: new Date('2024-03-01T00:00:00Z'),
        snapshotIds: ['s3'],
      }));
    });

    after(() => repository.removeAll());

    context('when the service exists and has versions', () => {
      let response;

      before(async () => {
        response = await request.get(`${basePath}/v1/feed/${encodeURIComponent(SERVICE)}`);
      });

      it('responds with 200', () => {
        expect(response.status).to.equal(200);
      });

      it('responds with Content-Type application/atom+xml', () => {
        expect(response.headers['content-type']).to.match(/^application\/atom\+xml/);
      });

      it('includes only entries for that service', () => {
        const serviceTerms = [...response.text.matchAll(/scheme="tag:opentermsarchive.org,2026:scheme:service"[^/]*term="([^"]+)"/g)]
          .concat([...response.text.matchAll(/term="([^"]+)"[^/]*scheme="tag:opentermsarchive.org,2026:scheme:service"/g)])
          .map(match => match[1]);

        expect(serviceTerms).to.not.be.empty;

        for (const term of serviceTerms) {
          expect(term).to.equal(SERVICE);
        }
      });

      it('has a feed id including the service id', () => {
        expect(extractTag(response.text, 'id')).to.equal(`tag:opentermsarchive.org,2026:feed:test:${SERVICE}`);
      });

      it('has a self link pointing to the service-scoped feed endpoint', () => {
        const href = response.text.match(/<link[^>]*rel="self"[^>]*href="([^"]+)"/)[1];

        expect(href).to.match(new RegExp(`/feed/${SERVICE}$`));
      });
    });

    context('when the service exists but has no versions', () => {
      let response;

      before(async () => {
        response = await request.get(`${basePath}/v1/feed/${encodeURIComponent('service_with_filters_history')}`);
      });

      it('responds with 200', () => {
        expect(response.status).to.equal(200);
      });

      it('returns an empty feed (no entries)', () => {
        expect(response.text).to.not.include('<entry>');
      });
    });

    context('when the service does not exist', () => {
      let response;

      before(async () => {
        response = await request.get(`${basePath}/v1/feed/DoesNotExist`);
      });

      it('responds with 404', () => {
        expect(response.status).to.equal(404);
      });
    });

    context('when the serviceId uses different casing', () => {
      let response;

      before(async () => {
        response = await request.get(`${basePath}/v1/feed/${encodeURIComponent(SERVICE.toUpperCase())}`);
      });

      it('still resolves to the service (case-insensitive)', () => {
        expect(response.status).to.equal(200);
      });
    });
  });

  describe('XML escaping and URL encoding', () => {
    const SERVICE = 'Service B!';
    const TERMS = 'Privacy Policy';
    const FETCH_DATE = new Date('2024-05-15T10:00:00Z');

    let response;
    let repository;

    before(async function () {
      this.timeout(5000);
      repository = RepositoryFactory.create(storageConfig);
      await repository.initialize();

      await repository.save(new Version({
        serviceId: SERVICE,
        termsType: TERMS,
        content: 'content with & and <tags>',
        fetchDate: FETCH_DATE,
        snapshotIds: ['s_escape'],
      }));

      response = await request.get(`${basePath}/v1/feed/${encodeURIComponent(SERVICE)}/${encodeURIComponent(TERMS)}`);
    });

    after(() => repository.removeAll());

    it('responds with 200', () => {
      expect(response.status).to.equal(200);
    });

    it('URL-encodes spaces and special characters in the self link href', () => {
      const href = response.text.match(/<link[^>]*rel="self"[^>]*href="([^"]+)"/)[1];

      expect(href).to.include('Service%20B!');
      expect(href).to.include('Privacy%20Policy');
      expect(href).to.not.include('Service B!');
    });

    it('URL-encodes spaces and special characters in entry alternate links', () => {
      const href = response.text.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/)[1];

      expect(href).to.include('Service%20B!');
      expect(href).to.include('Privacy%20Policy');
    });
  });

  describe('GET /feed/:serviceId/:termsType', () => {
    const SERVICE = 'service_without_history';
    const TERMS = 'Terms of Service';
    const UNKNOWN_TERMS = 'Imprint';

    let repository;

    before(async function () {
      this.timeout(5000);
      repository = RepositoryFactory.create(storageConfig);
      await repository.initialize();

      await repository.save(new Version({
        serviceId: SERVICE,
        termsType: TERMS,
        content: 'first',
        fetchDate: new Date('2024-01-01T00:00:00Z'),
        snapshotIds: ['s1'],
      }));
      await repository.save(new Version({
        serviceId: SERVICE,
        termsType: TERMS,
        content: 'updated',
        fetchDate: new Date('2024-02-01T00:00:00Z'),
        snapshotIds: ['s2'],
      }));
    });

    after(() => repository.removeAll());

    context('when the service and terms type match', () => {
      let response;

      before(async () => {
        response = await request.get(`${basePath}/v1/feed/${encodeURIComponent(SERVICE)}/${encodeURIComponent(TERMS)}`);
      });

      it('responds with 200', () => {
        expect(response.status).to.equal(200);
      });

      it('includes entries for the combination', () => {
        const entries = response.text.match(/<entry>/g) || [];

        expect(entries.length).to.be.at.least(1);
      });

      it('entries only have the expected terms type', () => {
        const termsTypeTerms = [...response.text.matchAll(/<category[^/]*scheme="tag:opentermsarchive.org,2026:scheme:terms-type"[^/]*term="([^"]+)"/g)]
          .concat([...response.text.matchAll(/<category[^/]*term="([^"]+)"[^/]*scheme="tag:opentermsarchive.org,2026:scheme:terms-type"/g)])
          .map(match => match[1]);

        for (const term of termsTypeTerms) {
          expect(term).to.equal(TERMS);
        }
      });

      it('has a feed id that includes both service and terms type', () => {
        expect(extractTag(response.text, 'id')).to.equal(`tag:opentermsarchive.org,2026:feed:test:${SERVICE}:${TERMS}`);
      });

      it('has a self link pointing to the combination endpoint', () => {
        const href = response.text.match(/<link[^>]*rel="self"[^>]*href="([^"]+)"/)[1];

        expect(href).to.match(new RegExp(`/feed/${SERVICE}/${encodeURIComponent(TERMS)}$`));
      });
    });

    context('when the service exists but does not declare the terms type', () => {
      let response;

      before(async () => {
        response = await request.get(`${basePath}/v1/feed/${encodeURIComponent(SERVICE)}/${encodeURIComponent(UNKNOWN_TERMS)}`);
      });

      it('responds with 404', () => {
        expect(response.status).to.equal(404);
      });
    });

    context('when the service does not exist', () => {
      let response;

      before(async () => {
        response = await request.get(`${basePath}/v1/feed/DoesNotExist/${encodeURIComponent(TERMS)}`);
      });

      it('responds with 404', () => {
        expect(response.status).to.equal(404);
      });
    });
  });
});
