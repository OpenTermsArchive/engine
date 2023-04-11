import fsApi from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import chai from 'chai';
import config from 'config';
import nock from 'nock';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import Git from './recorder/repositories/git/git.js';

import Archivist, { EVENTS } from './index.js';

const fs = fsApi.promises;

chai.use(sinonChai);
const { expect } = chai;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_PATH = path.resolve(__dirname, '../../');
const SNAPSHOTS_PATH = path.resolve(ROOT_PATH, config.get('recorder.snapshots.storage.git.path'));
const VERSIONS_PATH = path.resolve(ROOT_PATH, config.get('recorder.versions.storage.git.path'));

const MIME_TYPE = 'text/html';
const FETCH_DATE = new Date('2000-01-02T12:00:00.000Z');
let gitVersion;
let app;

async function resetGitRepositories() {
  return Promise.all([ app.recorder.snapshotsRepository.removeAll(), app.recorder.versionsRepository.removeAll() ]);
}

describe('Archivist', function () {
  this.timeout(10000);

  const SERVICE_A_ID = 'service_A';
  const SERVICE_A_TYPE = 'Terms of Service';
  const SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH = `${SNAPSHOTS_PATH}/${SERVICE_A_ID}/${SERVICE_A_TYPE}.html`;
  const SERVICE_A_EXPECTED_VERSION_FILE_PATH = `${VERSIONS_PATH}/${SERVICE_A_ID}/${SERVICE_A_TYPE}.md`;
  let serviceASnapshotExpectedContent;
  let serviceAVersionExpectedContent;

  const SERVICE_B_ID = 'service_B';
  const SERVICE_B_TYPE = 'Privacy Policy';
  const SERVICE_B_EXPECTED_SNAPSHOT_FILE_PATH = `${SNAPSHOTS_PATH}/${SERVICE_B_ID}/${SERVICE_B_TYPE}.pdf`;
  const SERVICE_B_EXPECTED_VERSION_FILE_PATH = `${VERSIONS_PATH}/${SERVICE_B_ID}/${SERVICE_B_TYPE}.md`;
  let serviceBSnapshotExpectedContent;
  let serviceBVersionExpectedContent;

  const services = [ 'service_A', 'service_B' ];

  before(async () => {
    gitVersion = new Git({
      path: VERSIONS_PATH,
      author: {
        name: config.get('recorder.versions.storage.git.author.name'),
        email: config.get('recorder.versions.storage.git.author.email'),
      },
    });
    await gitVersion.initialize();

    serviceASnapshotExpectedContent = await fs.readFile(path.resolve(ROOT_PATH, 'test/fixtures/service_A_terms_snapshot.html'), { encoding: 'utf8' });
    serviceAVersionExpectedContent = await fs.readFile(path.resolve(ROOT_PATH, 'test/fixtures/service_A_terms.md'), { encoding: 'utf8' });
    serviceBSnapshotExpectedContent = await fs.readFile(path.resolve(ROOT_PATH, 'test/fixtures/terms.pdf'));
    serviceBVersionExpectedContent = await fs.readFile(path.resolve(ROOT_PATH, 'test/fixtures/termsFromPDF.md'), { encoding: 'utf8' });
  });

  describe('#track', () => {
    before(async () => {
      nock('https://www.servicea.example').get('/tos').reply(200, serviceASnapshotExpectedContent, { 'Content-Type': 'text/html' });
      nock('https://www.serviceb.example').get('/privacy').reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });
      app = new Archivist({
        recorderConfig: config.get('recorder'),
        fetcherConfig: config.get('fetcher'),
      });
      await app.initialize();
    });

    context('when everything works fine', () => {
      before(async () => app.track({ services }));

      after(resetGitRepositories);

      it('records snapshot for service A', async () => {
        const resultingSnapshotTerms = await fs.readFile(path.resolve(__dirname, SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH), { encoding: 'utf8' });

        expect(resultingSnapshotTerms).to.equal(serviceASnapshotExpectedContent);
      });

      it('records version for service A', async () => {
        const resultingTerms = await fs.readFile(path.resolve(__dirname, SERVICE_A_EXPECTED_VERSION_FILE_PATH), { encoding: 'utf8' });

        expect(resultingTerms).to.equal(serviceAVersionExpectedContent);
      });

      it('records snapshot for service B', async () => {
        const resultingSnapshotTerms = await fs.readFile(path.resolve(__dirname, SERVICE_B_EXPECTED_SNAPSHOT_FILE_PATH));

        expect(resultingSnapshotTerms.equals(serviceBSnapshotExpectedContent)).to.be.true;
      });

      it('records version for service B', async () => {
        const resultingTerms = await fs.readFile(path.resolve(__dirname, SERVICE_B_EXPECTED_VERSION_FILE_PATH), { encoding: 'utf8' });

        expect(resultingTerms).to.equal(serviceBVersionExpectedContent);
      });
    });

    context('when there is an operational error with service A', () => {
      before(async () => {
        // as there is no more HTTP request mocks for service A, it should throw an `ENOTFOUND` error which is considered as an expected error in our workflow
        nock.cleanAll();
        nock('https://www.serviceb.example').get('/privacy').reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });
        await app.track({ services });
      });

      after(resetGitRepositories);

      it('records no snapshot for service A', async () => {
        expect(fsApi.existsSync(path.resolve(__dirname, SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH))).to.be.false;
      });

      it('records no version for service A', async () => {
        expect(fsApi.existsSync(path.resolve(__dirname, SERVICE_A_EXPECTED_VERSION_FILE_PATH))).to.be.false;
      });

      it('still records snapshot for service B', async () => {
        const resultingSnapshotTerms = await fs.readFile(path.resolve(__dirname, SERVICE_B_EXPECTED_SNAPSHOT_FILE_PATH));

        expect(resultingSnapshotTerms.equals(serviceBSnapshotExpectedContent)).to.be.true;
      });

      it('still records version for service B', async () => {
        const resultingTerms = await fs.readFile(path.resolve(__dirname, SERVICE_B_EXPECTED_VERSION_FILE_PATH), { encoding: 'utf8' });

        expect(resultingTerms).to.equal(serviceBVersionExpectedContent);
      });
    });

    context('extracting only', () => {
      context('when a service’s filter declaration changes', () => {
        context('when everything works fine', () => {
          let originalSnapshotId;
          let firstVersionId;
          let reExtractedVersionId;
          let reExtractedVersionMessageBody;
          let serviceBCommits;

          before(async () => {
            nock('https://www.servicea.example').get('/tos').reply(200, serviceASnapshotExpectedContent, { 'Content-Type': 'text/html' });
            nock('https://www.serviceb.example').get('/privacy').reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });
            app = new Archivist({
              recorderConfig: config.get('recorder'),
              fetcherConfig: config.get('fetcher'),
            });

            await app.initialize();
            await app.track({ services });

            ({ id: originalSnapshotId } = await app.recorder.snapshotsRepository.findLatest(SERVICE_A_ID, SERVICE_A_TYPE));
            ({ id: firstVersionId } = await app.recorder.versionsRepository.findLatest(SERVICE_A_ID, SERVICE_A_TYPE));

            serviceBCommits = await gitVersion.log({ file: SERVICE_B_EXPECTED_VERSION_FILE_PATH });

            app.services[SERVICE_A_ID].getTerms(SERVICE_A_TYPE).sourceDocuments[0].contentSelectors = 'h1';

            await app.track({ services: [ 'service_A', 'service_B' ], extractOnly: true });

            const [reExtractedVersionCommit] = await gitVersion.log({ file: SERVICE_A_EXPECTED_VERSION_FILE_PATH });

            reExtractedVersionId = reExtractedVersionCommit.hash;
            reExtractedVersionMessageBody = reExtractedVersionCommit.body;
          });

          after(resetGitRepositories);

          it('updates the version of the changed service', async () => {
            const serviceAContent = await fs.readFile(path.resolve(__dirname, SERVICE_A_EXPECTED_VERSION_FILE_PATH), { encoding: 'utf8' });

            expect(serviceAContent).to.equal('Terms of service with UTF-8 \'çhãràčtęrs"\n========================================');
          });

          it('generates a new version id', async () => {
            expect(reExtractedVersionId).to.not.equal(firstVersionId);
          });

          it('mentions the snapshot id in the changelog', async () => {
            expect(reExtractedVersionMessageBody).to.include(originalSnapshotId);
          });

          it('does not change other services', async () => {
            const serviceBVersion = await fs.readFile(path.resolve(__dirname, SERVICE_B_EXPECTED_VERSION_FILE_PATH), { encoding: 'utf8' });

            expect(serviceBVersion).to.equal(serviceBVersionExpectedContent);
          });

          it('does not generate a new id for other services', async () => {
            const serviceBCommitsAfterExtraction = await gitVersion.log({ file: SERVICE_B_EXPECTED_VERSION_FILE_PATH });

            expect(serviceBCommitsAfterExtraction.map(commit => commit.hash)).to.deep.equal(serviceBCommits.map(commit => commit.hash));
          });
        });

        context('when there is an operational error with service A', () => {
          let inaccessibleContentSpy;
          let versionNotChangedSpy;
          let versionB;

          before(async () => {
            nock('https://www.servicea.example').get('/tos').reply(200, serviceASnapshotExpectedContent, { 'Content-Type': 'text/html' });
            nock('https://www.serviceb.example').get('/privacy').reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });
            app = new Archivist({
              recorderConfig: config.get('recorder'),
              fetcherConfig: config.get('fetcher'),
            });

            await app.initialize();
            await app.track({ services });
            app.services[SERVICE_A_ID].getTerms(SERVICE_A_TYPE).sourceDocuments[0].contentSelectors = 'inexistant-selector';
            inaccessibleContentSpy = sinon.spy();
            versionNotChangedSpy = sinon.spy();
            app.on('inaccessibleContent', inaccessibleContentSpy);
            app.on('versionNotChanged', record => {
              if (record.serviceId == 'service_B') {
                versionB = record;
              }
              versionNotChangedSpy(record);
            });
            await app.track({ services, extractOnly: true });
          });

          after(resetGitRepositories);

          it('emits an inaccessibleContent event', async () => {
            expect(inaccessibleContentSpy).to.have.been.called;
          });

          it('still extracts the terms of other services', async () => {
            expect(versionNotChangedSpy).to.have.been.calledWith(versionB);
          });
        });
      });
    });
  });

  describe('events', () => {
    const spies = {};

    function resetSpiesHistory() {
      Object.keys(spies).forEach(spyName => spies[spyName].resetHistory());
    }

    function emitsOnly(eventNames) {
      EVENTS.filter(el => eventNames.indexOf(el) < 0).forEach(event => {
        const handlerName = `on${event[0].toUpperCase()}${event.substr(1)}`;

        it(`emits no "${event}" event`, () => {
          expect(spies[handlerName]).to.have.not.been.called;
        });
      });
    }

    before(async () => {
      app = new Archivist({
        recorderConfig: config.get('recorder'),
        fetcherConfig: config.get('fetcher'),
      });
      await app.initialize();

      EVENTS.forEach(event => {
        const handlerName = `on${event[0].toUpperCase()}${event.substr(1)}`;

        spies[handlerName] = sinon.spy();
        app.on(event, spies[handlerName]);
      });
    });

    describe('#recordTermsSnapshots', () => {
      let terms;
      let snapshot;

      before(async () => {
        terms = app.services.service_A.getTerms(SERVICE_A_TYPE);
        terms.fetchDate = FETCH_DATE;
        terms.sourceDocuments.forEach(async sourceDocument => {
          sourceDocument.content = serviceASnapshotExpectedContent;
          sourceDocument.mimeType = MIME_TYPE;
        });
        resetSpiesHistory();
      });

      context('when it is the first record', () => {
        before(async () => {
          [snapshot] = await app.recordTermsSnapshots(terms);
        });

        after(() => {
          resetSpiesHistory();

          return resetGitRepositories();
        });

        it('emits "firstSnapshotRecorded" event', async () => {
          expect(spies.onFirstSnapshotRecorded).to.have.been.calledWith(snapshot);
        });

        emitsOnly(['firstSnapshotRecorded']);
      });

      context('when it is not the first record', () => {
        context('when there are changes', () => {
          let changedSnapshot;

          before(async () => {
            await app.recordTermsSnapshots(terms);
            resetSpiesHistory();
            terms.sourceDocuments.forEach(async sourceDocument => {
              sourceDocument.content = serviceBSnapshotExpectedContent;
            });
            [changedSnapshot] = await app.recordTermsSnapshots(terms);
          });

          after(() => {
            resetSpiesHistory();

            return resetGitRepositories();
          });

          it('emits "snapshotRecorded" event', async () => {
            expect(spies.onSnapshotRecorded).to.have.been.calledWith(changedSnapshot);
          });

          emitsOnly(['snapshotRecorded']);
        });

        context('when there are no changes', () => {
          let snapshot;

          before(async () => {
            await app.recordTermsSnapshots(terms);
            resetSpiesHistory();
            [snapshot] = await app.recordTermsSnapshots(terms);
          });

          after(() => {
            resetSpiesHistory();

            return resetGitRepositories();
          });

          it('emits "snapshotNotChanged" event', async () => {
            expect(spies.onSnapshotNotChanged).to.have.been.calledWith(snapshot);
          });

          emitsOnly(['snapshotNotChanged']);
        });
      });
    });

    describe('#recordTermsVersion', () => {
      let terms;
      let version;

      before(async () => {
        terms = app.services.service_A.getTerms(SERVICE_A_TYPE);
        terms.fetchDate = FETCH_DATE;
        terms.sourceDocuments.forEach(async sourceDocument => {
          sourceDocument.content = serviceASnapshotExpectedContent;
          sourceDocument.mimeType = MIME_TYPE;
        });
        resetSpiesHistory();
      });

      context('when it is the first record', () => {
        before(async () => {
          version = await app.recordTermsVersion(terms);
        });

        after(() => {
          resetSpiesHistory();

          return resetGitRepositories();
        });

        it('emits "firstVersionRecorded" event', async () => {
          expect(spies.onFirstVersionRecorded).to.have.been.calledWith(version);
        });

        emitsOnly(['firstVersionRecorded']);
      });

      context('when it is not the first record', () => {
        context('when there are changes', () => {
          let changedVersion;

          before(async () => {
            await app.recordTermsVersion(terms);
            resetSpiesHistory();
            terms.sourceDocuments.forEach(async sourceDocument => {
              sourceDocument.content = serviceBSnapshotExpectedContent;
            });
            changedVersion = await app.recordTermsVersion(terms);
          });

          after(() => {
            resetSpiesHistory();

            return resetGitRepositories();
          });

          it('emits "versionRecorded" event', async () => {
            expect(spies.onVersionRecorded).to.have.been.calledWith(changedVersion);
          });

          emitsOnly(['versionRecorded']);
        });

        context('when there are no changes', () => {
          let version;

          before(async () => {
            await app.recordTermsVersion(terms);
            resetSpiesHistory();
            version = await app.recordTermsVersion(terms);
          });

          after(() => {
            resetSpiesHistory();

            return resetGitRepositories();
          });

          it('emits "versionNotChanged" event', async () => {
            expect(spies.onVersionNotChanged).to.have.been.calledWith(version);
          });

          emitsOnly(['versionNotChanged']);
        });
      });
    });

    context('when tracking changes on new services', () => {
      before(async () => {
        nock('https://www.servicea.example').get('/tos').reply(200, serviceASnapshotExpectedContent, { 'Content-Type': 'text/html' });
        nock('https://www.serviceb.example').get('/privacy').reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });

        return app.track({ services });
      });

      after(() => {
        resetSpiesHistory();

        return resetGitRepositories();
      });

      it('emits "trackingStarted" event', async () => {
        expect(spies.onTrackingStarted).to.have.been.calledOnce;
      });

      it('emits "firstSnapshotRecorded" events', async () => {
        expect(spies.onFirstSnapshotRecorded).to.have.been.calledTwice;
      });

      it('emits "firstVersionRecorded" events', async () => {
        expect(spies.onFirstVersionRecorded).to.have.been.calledTwice;
      });

      it('emits "firstVersionRecorded" events after "firstSnapshotRecorded" events', async () => {
        expect(spies.onFirstVersionRecorded).to.have.been.calledAfter(spies.onFirstSnapshotRecorded);
      });

      it('emits "trackingCompleted" event', async () => {
        expect(spies.onTrackingCompleted).to.have.been.calledAfter(spies.onTrackingStarted);
      });

      emitsOnly([
        'firstSnapshotRecorded',
        'firstVersionRecorded',
        'trackingStarted',
        'trackingCompleted',
      ]);
    });

    context('when tracking changes on already tracked services', () => {
      context('when services did not change', () => {
        before(async () => {
          nock('https://www.servicea.example').get('/tos').reply(200, serviceASnapshotExpectedContent, { 'Content-Type': 'text/html' });
          nock('https://www.serviceb.example').get('/privacy').reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });

          await app.track({ services });

          nock('https://www.servicea.example').get('/tos').reply(200, serviceASnapshotExpectedContent, { 'Content-Type': 'text/html' });
          nock('https://www.serviceb.example').get('/privacy').reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });

          resetSpiesHistory();

          return app.track({ services });
        });

        after(() => {
          resetSpiesHistory();

          return resetGitRepositories();
        });

        it('emits "trackingStarted" event', async () => {
          expect(spies.onTrackingStarted).to.have.been.calledOnce;
        });

        it('emits "snapshotNotChanged" events', async () => {
          expect(spies.onSnapshotNotChanged).to.have.been.calledTwice;
        });

        it('emits "versionNotChanged" events', async () => {
          expect(spies.onVersionNotChanged).to.have.been.calledTwice;
        });

        it('emits "versionNotChanged" events after "snapshotRecorded" events', async () => {
          expect(spies.onVersionNotChanged).to.have.been.calledAfter(spies.onSnapshotNotChanged);
        });

        it('emits "trackingCompleted" event', async () => {
          expect(spies.onTrackingCompleted).to.have.been.calledAfter(spies.onTrackingStarted);
        });

        emitsOnly([
          'snapshotNotChanged',
          'versionNotChanged',
          'trackingStarted',
          'trackingCompleted',
        ]);
      });

      context('when a service changed', () => {
        let snapshotA;
        let snapshotB;
        let versionA;
        let versionB;

        before(async () => {
          nock('https://www.servicea.example').get('/tos').reply(200, serviceASnapshotExpectedContent, { 'Content-Type': 'text/html' });
          nock('https://www.serviceb.example').get('/privacy').reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });

          await app.track({ services });

          nock('https://www.servicea.example').get('/tos').reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'text/html' });
          nock('https://www.serviceb.example').get('/privacy').reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });

          resetSpiesHistory();
          app.on('snapshotNotChanged', record => {
            snapshotB = record;
          });
          app.on('snapshotRecorded', record => {
            snapshotA = record;
          });
          app.on('versionNotChanged', record => {
            versionB = record;
          });
          app.on('versionRecorded', record => {
            versionA = record;
          });
          await app.track({ services });
        });

        after(() => {
          resetSpiesHistory();

          return resetGitRepositories();
        });

        it('emits "trackingStarted" event', async () => {
          expect(spies.onTrackingStarted).to.have.been.calledOnce;
        });

        it('emits "snapshotNotChanged" event for the service that was not changed', async () => {
          expect(spies.onSnapshotNotChanged).to.have.been.calledOnceWith(snapshotB);
        });

        it('emits "snapshotRecorded" event for the service that was changed', async () => {
          expect(spies.onSnapshotRecorded).to.have.been.calledOnceWith(snapshotA);
        });

        it('emits "versionNotChanged" events for the service that was not changed', async () => {
          expect(spies.onVersionNotChanged).to.have.been.calledOnceWith(versionB);
        });

        it('emits "versionRecorded" event for the service that was changed', async () => {
          expect(spies.onVersionRecorded).to.have.been.calledOnceWith(versionA);
        });

        it('emits "snapshotRecorded" events after "versionRecorded" events', async () => {
          expect(spies.onVersionRecorded).to.have.been.calledAfter(spies.onSnapshotRecorded);
        });

        it('emits "trackingCompleted" event', async () => {
          expect(spies.onTrackingCompleted).to.have.been.calledAfter(spies.onTrackingStarted);
        });

        emitsOnly([
          'snapshotNotChanged',
          'snapshotRecorded',
          'versionNotChanged',
          'versionRecorded',
          'trackingStarted',
          'trackingCompleted',
        ]);
      });
    });
  });
});
