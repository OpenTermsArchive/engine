import fsApi from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { expect, use } from 'chai';
import config from 'config';
import nock from 'nock';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { InaccessibleContentError } from './errors.js';
import { FetchDocumentError } from './fetcher/index.js';
import Git from './recorder/repositories/git/git.js';
import SourceDocument from './services/sourceDocument.js';

import Archivist, { EVENTS } from './index.js';

const fs = fsApi.promises;

use(sinonChai);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_PATH = path.resolve(__dirname, '../../');
const SNAPSHOTS_PATH = path.resolve(ROOT_PATH, config.get('@opentermsarchive/engine.recorder.snapshots.storage.git.path'));
const VERSIONS_PATH = path.resolve(ROOT_PATH, config.get('@opentermsarchive/engine.recorder.versions.storage.git.path'));

const MIME_TYPE = 'text/html';
const FETCH_DATE = new Date('2000-01-02T12:00:00.000Z');
let gitVersion;
let app;

function resetGitRepositories() {
  return Promise.all([ app.recorder.snapshotsRepository.removeAll(), app.recorder.versionsRepository.removeAll() ]);
}

describe('Archivist', function () {
  this.timeout(10000);

  const SERVICE_A_ID = 'service·A';
  const SERVICE_A_TYPE = 'Terms of Service';
  const SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH = `${SNAPSHOTS_PATH}/${SERVICE_A_ID}/${SERVICE_A_TYPE}.html`;
  const SERVICE_A_EXPECTED_VERSION_FILE_PATH = `${VERSIONS_PATH}/${SERVICE_A_ID}/${SERVICE_A_TYPE}.md`;
  let serviceASnapshotExpectedContent;
  let serviceAVersionExpectedContent;

  const SERVICE_B_ID = 'Service B!';
  const SERVICE_B_TYPE = 'Privacy Policy';
  const SERVICE_B_EXPECTED_SNAPSHOT_FILE_PATH = `${SNAPSHOTS_PATH}/${SERVICE_B_ID}/${SERVICE_B_TYPE}.pdf`;
  const SERVICE_B_EXPECTED_VERSION_FILE_PATH = `${VERSIONS_PATH}/${SERVICE_B_ID}/${SERVICE_B_TYPE}.md`;
  let serviceBSnapshotExpectedContent;
  let serviceBVersionExpectedContent;

  const services = [ 'service·A', 'Service B!' ];

  function setupNockForServices({ serviceA = true, serviceB = true } = {}) {
    nock.cleanAll();
    if (serviceA) {
      nock('https://www.servicea.example')
        .get('/tos')
        .reply(200, serviceASnapshotExpectedContent, { 'Content-Type': 'text/html' });
    }
    if (serviceB) {
      nock('https://www.serviceb.example')
        .get('/privacy')
        .reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });
    }
  }

  async function createAndInitializeArchivist() {
    const archivist = new Archivist({
      recorderConfig: config.get('@opentermsarchive/engine.recorder'),
      fetcherConfig: config.get('@opentermsarchive/engine.fetcher'),
    });

    await archivist.initialize();

    return archivist;
  }

  before(async () => {
    gitVersion = new Git({
      path: VERSIONS_PATH,
      author: {
        name: config.get('@opentermsarchive/engine.recorder.versions.storage.git.author.name'),
        email: config.get('@opentermsarchive/engine.recorder.versions.storage.git.author.email'),
      },
    });
    await gitVersion.initialize();

    serviceASnapshotExpectedContent = await fs.readFile(path.resolve(ROOT_PATH, 'test/fixtures/service·A_terms_snapshot.html'), { encoding: 'utf8' });
    serviceAVersionExpectedContent = await fs.readFile(path.resolve(ROOT_PATH, 'test/fixtures/service·A_terms.md'), { encoding: 'utf8' });
    serviceBSnapshotExpectedContent = await fs.readFile(path.resolve(ROOT_PATH, 'test/fixtures/terms.pdf'));
    serviceBVersionExpectedContent = await fs.readFile(path.resolve(ROOT_PATH, 'test/fixtures/termsFromPDF.md'), { encoding: 'utf8' });
  });

  describe('#track', () => {
    before(async () => {
      setupNockForServices();
      app = await createAndInitializeArchivist();
    });

    context('when everything works fine', () => {
      before(() => app.track({ services }));

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
        setupNockForServices({ serviceA: false, serviceB: true });
        await app.track({ services });
      });

      after(resetGitRepositories);

      it('records no snapshot for service A', () => {
        expect(fsApi.existsSync(path.resolve(__dirname, SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH))).to.be.false;
      });

      it('records no version for service A', () => {
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
  });

  describe('#applyTechnicalUpgrades', () => {
    context('when a service’s filter declaration changes', () => {
      context('when everything works fine', () => {
        let originalSnapshotId;
        let firstVersionId;
        let reExtractedVersionId;
        let reExtractedVersionMessageBody;
        let serviceBCommits;

        before(async () => {
          setupNockForServices();
          app = await createAndInitializeArchivist();
          await app.track({ services });

          ({ id: originalSnapshotId } = await app.recorder.snapshotsRepository.findLatest(SERVICE_A_ID, SERVICE_A_TYPE));
          ({ id: firstVersionId } = await app.recorder.versionsRepository.findLatest(SERVICE_A_ID, SERVICE_A_TYPE));

          serviceBCommits = await gitVersion.log({ file: SERVICE_B_EXPECTED_VERSION_FILE_PATH });

          app.services[SERVICE_A_ID].getTerms({ type: SERVICE_A_TYPE }).sourceDocuments[0].contentSelectors = 'h1';

          await app.applyTechnicalUpgrades({ services: [ 'service·A', 'Service B!' ] });

          const [reExtractedVersionCommit] = await gitVersion.log({ file: SERVICE_A_EXPECTED_VERSION_FILE_PATH });

          reExtractedVersionId = reExtractedVersionCommit.hash;
          reExtractedVersionMessageBody = reExtractedVersionCommit.body;
        });

        after(resetGitRepositories);

        it('updates the version of the changed service', async () => {
          const serviceAContent = await fs.readFile(path.resolve(__dirname, SERVICE_A_EXPECTED_VERSION_FILE_PATH), { encoding: 'utf8' });

          expect(serviceAContent).to.equal('Terms of service with UTF-8 \'çhãràčtęrs"\n========================================');
        });

        it('generates a new version id', () => {
          expect(reExtractedVersionId).to.not.equal(firstVersionId);
        });

        it('mentions the snapshot id in the changelog', () => {
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
          setupNockForServices();
          app = await createAndInitializeArchivist();
          await app.track({ services });
          app.services[SERVICE_A_ID].getTerms({ type: SERVICE_A_TYPE }).sourceDocuments[0].contentSelectors = 'inexistant-selector';
          inaccessibleContentSpy = sinon.spy();
          versionNotChangedSpy = sinon.spy();
          app.on('inaccessibleContent', inaccessibleContentSpy);
          app.on('versionNotChanged', record => {
            if (record.serviceId == 'Service B!') {
              versionB = record;
            }
            versionNotChangedSpy(record);
          });
          await app.applyTechnicalUpgrades({ services });
        });

        after(resetGitRepositories);

        it('emits an inaccessibleContent event', () => {
          expect(inaccessibleContentSpy).to.have.been.called;
        });

        it('still extracts the terms of other services', () => {
          expect(versionNotChangedSpy).to.have.been.calledWith(versionB);
        });
      });

      describe('with combined source documents', () => {
        const SERVICE_ID = 'service_with_multiple_source_documents_terms';
        const TERMS_TYPE = 'Community Guidelines';
        const MOCK_CONTENT_1 = '<html><body id="main"><h1>Community Standards</h1><p>Community Standards content</p></body></html>';
        const MOCK_CONTENT_2 = '<html><body><p>Hate speech content</p><div id="footer">Footer</div></body></html>';
        const MOCK_CONTENT_3 = '<html><body><p>Violence incitement content</p><button class="share">Share</button><button class="print">Print</button></body></html>';
        const MOCK_CONTENT_4 = '<html><body><p>New additional policy</p></body></html>';

        context('when a source document is added to existing combined terms', () => {
          let initialVersion;
          let upgradeVersion;

          before(async () => {
            // Mock all source documents
            nock('https://www.service-with-multiple-source-documents-terms.example')
              .persist()
              .get('/community-standards')
              .reply(200, MOCK_CONTENT_1, { 'Content-Type': 'text/html' });

            nock('https://www.service-with-multiple-source-documents-terms.example')
              .persist()
              .get('/community-standards/hate-speech/')
              .reply(200, MOCK_CONTENT_2, { 'Content-Type': 'text/html' });

            nock('https://www.service-with-multiple-source-documents-terms.example')
              .persist()
              .get('/community-standards/violence-incitement/')
              .reply(200, MOCK_CONTENT_3, { 'Content-Type': 'text/html' });

            nock('https://www.service-with-multiple-source-documents-terms.example')
              .persist()
              .get('/community-standards/new-policy/')
              .reply(200, MOCK_CONTENT_4, { 'Content-Type': 'text/html' });

            app = await createAndInitializeArchivist();

            let terms = app.services[SERVICE_ID].getTerms({ type: TERMS_TYPE });

            terms.sourceDocuments.forEach(doc => {
              doc.executeClientScripts = false; // Disable executeClientScripts for testing since nock doesn't work with headless browser
            });

            // First, track the terms normally to create initial version
            await app.track({ services: [SERVICE_ID], types: [TERMS_TYPE] });
            initialVersion = await app.recorder.versionsRepository.findLatest(SERVICE_ID, TERMS_TYPE);

            // Modify the declaration to add a new source document
            terms = app.services[SERVICE_ID].getTerms({ type: TERMS_TYPE });

            terms.sourceDocuments.push(new SourceDocument({
              id: 'new-policy',
              location: 'https://www.service-with-multiple-source-documents-terms.example/community-standards/new-policy/',
              contentSelectors: 'body',
              executeClientScripts: false,
              filters: [],
            }));

            // Apply technical upgrades
            await app.applyTechnicalUpgrades({ services: [SERVICE_ID], types: [TERMS_TYPE] });
            upgradeVersion = await app.recorder.versionsRepository.findLatest(SERVICE_ID, TERMS_TYPE);
          });

          after(async () => {
            await resetGitRepositories();
            nock.cleanAll();
          });

          it('creates a new version', () => {
            expect(upgradeVersion.id).to.not.equal(initialVersion.id);
          });

          it('marks the new version as technical upgrade', () => {
            expect(upgradeVersion.isTechnicalUpgrade).to.be.true;
          });

          it('fetches and includes the new source document in the version', async () => {
            const versionContent = await upgradeVersion.content;

            expect(versionContent).to.include('New additional policy');
          });

          it('includes all source documents in version', async () => {
            const versionContent = await upgradeVersion.content;

            expect(versionContent).to.include('Community Standards');
            expect(versionContent).to.include('Hate speech content');
            expect(versionContent).to.include('Violence incitement content');
            expect(versionContent).to.include('New additional policy');
          });
        });

        context('when a source document location is modified in combined terms', () => {
          let initialVersion;
          let latestVersion;
          let newLocationScope;

          before(async () => {
            // Mock all source documents
            nock('https://www.service-with-multiple-source-documents-terms.example')
              .persist()
              .get('/community-standards')
              .reply(200, MOCK_CONTENT_1, { 'Content-Type': 'text/html' });

            nock('https://www.service-with-multiple-source-documents-terms.example')
              .persist()
              .get('/community-standards/hate-speech/')
              .reply(200, MOCK_CONTENT_2, { 'Content-Type': 'text/html' });

            nock('https://www.service-with-multiple-source-documents-terms.example')
              .persist()
              .get('/community-standards/violence-incitement/')
              .reply(200, MOCK_CONTENT_3, { 'Content-Type': 'text/html' });

            app = await createAndInitializeArchivist();

            // Disable executeClientScripts for testing since nock doesn't work with headless browser
            let terms = app.services[SERVICE_ID].getTerms({ type: TERMS_TYPE });

            terms.sourceDocuments.forEach(doc => {
              doc.executeClientScripts = false;
            });

            // First, track the terms normally
            await app.track({ services: [SERVICE_ID], types: [TERMS_TYPE] });
            initialVersion = await app.recorder.versionsRepository.findLatest(SERVICE_ID, TERMS_TYPE);

            // Mock new location (but it won't be fetched during technical upgrade)
            newLocationScope = nock('https://www.service-with-multiple-source-documents-terms.example')
              .persist()
              .get('/community-standards/hate-speech-updated/')
              .reply(200, '<html><body><p>Updated hate speech policy</p></body></html>', { 'Content-Type': 'text/html' });

            // Modify the declaration to change location
            terms = app.services[SERVICE_ID].getTerms({ type: TERMS_TYPE });

            terms.sourceDocuments[1].location = 'https://www.service-with-multiple-source-documents-terms.example/community-standards/hate-speech-updated/';

            // Apply technical upgrades
            await app.applyTechnicalUpgrades({ services: [SERVICE_ID], types: [TERMS_TYPE] });
            latestVersion = await app.recorder.versionsRepository.findLatest(SERVICE_ID, TERMS_TYPE);
          });

          after(async () => {
            await resetGitRepositories();
            nock.cleanAll();
          });

          it('does not create a new version', () => {
            expect(latestVersion.id).to.equal(initialVersion.id);
          });

          it('does not fetch from new location', () => {
            expect(newLocationScope.isDone()).to.be.false;
          });

          it('does not include content from the new location', async () => {
            const versionContent = await latestVersion.content;

            expect(versionContent).to.not.include('Updated hate speech policy');
          });
        });

        context('when a source document selector is modified in combined terms', () => {
          let initialVersion;
          let latestVersion;
          let initialVersionContent;
          let upgradeVersionContent;

          before(async () => {
            // Mock all source documents
            nock('https://www.service-with-multiple-source-documents-terms.example')
              .persist()
              .get('/community-standards')
              .reply(200, MOCK_CONTENT_1, { 'Content-Type': 'text/html' });

            nock('https://www.service-with-multiple-source-documents-terms.example')
              .persist()
              .get('/community-standards/hate-speech/')
              .reply(200, MOCK_CONTENT_2, { 'Content-Type': 'text/html' });

            nock('https://www.service-with-multiple-source-documents-terms.example')
              .persist()
              .get('/community-standards/violence-incitement/')
              .reply(200, MOCK_CONTENT_3, { 'Content-Type': 'text/html' });

            app = await createAndInitializeArchivist();

            // Disable executeClientScripts for testing since nock doesn't work with headless browser
            let terms = app.services[SERVICE_ID].getTerms({ type: TERMS_TYPE });

            terms.sourceDocuments.forEach(doc => {
              doc.executeClientScripts = false;
            });

            // First, track the terms normally
            await app.track({ services: [SERVICE_ID], types: [TERMS_TYPE] });
            initialVersion = await app.recorder.versionsRepository.findLatest(SERVICE_ID, TERMS_TYPE);
            initialVersionContent = await initialVersion.content;

            // Modify the declaration to change selector
            terms = app.services[SERVICE_ID].getTerms({ type: TERMS_TYPE });

            // Change from 'body' to 'h1' for the first source document
            terms.sourceDocuments[0].contentSelectors = 'h1';

            // Apply technical upgrades
            await app.applyTechnicalUpgrades({ services: [SERVICE_ID], types: [TERMS_TYPE] });
            latestVersion = await app.recorder.versionsRepository.findLatest(SERVICE_ID, TERMS_TYPE);
            upgradeVersionContent = await latestVersion.content;
          });

          after(async () => {
            await resetGitRepositories();
            nock.cleanAll();
          });

          it('creates a new version', () => {
            expect(latestVersion.id).to.not.equal(initialVersion.id);
          });

          it('marks the new version as technical upgrade', () => {
            expect(latestVersion.isTechnicalUpgrade).to.be.true;
          });

          it('extracts content with the new selector from existing snapshot', () => {
            // With new selector 'h1', should only extract the heading
            expect(upgradeVersionContent).to.include('Community Standards');
            // The rest should be from other source documents
            expect(upgradeVersionContent).to.include('Hate speech content');
            expect(upgradeVersionContent).to.include('Violence incitement content');
          });

          it('regenerates version with updated extraction logic', () => {
            expect(upgradeVersionContent).to.not.equal(initialVersionContent);
          });
        });

        context('when adding source document but no version exists yet', () => {
          let newSourceScope;

          before(async () => {
            newSourceScope = nock('https://www.service-with-multiple-source-documents-terms.example')
              .get('/community-standards/new-policy/')
              .reply(200, MOCK_CONTENT_4, { 'Content-Type': 'text/html' });

            app = await createAndInitializeArchivist();

            // Modify declaration before any tracking
            const terms = app.services[SERVICE_ID].getTerms({ type: TERMS_TYPE });

            terms.sourceDocuments.push({
              id: 'new-policy',
              location: 'https://www.service-with-multiple-source-documents-terms.example/community-standards/new-policy/',
              contentSelectors: 'body',
              executeClientScripts: false,
              filters: [],
            });

            // Apply technical upgrades (should skip because no version exists)
            await app.applyTechnicalUpgrades({ services: [SERVICE_ID], types: [TERMS_TYPE] });
          });

          after(async () => {
            await resetGitRepositories();
            nock.cleanAll();
          });

          it('does not create a version when none existed before', async () => {
            const version = await app.recorder.versionsRepository.findLatest(SERVICE_ID, TERMS_TYPE);

            expect(version).to.be.null;
          });

          it('does not fetch the new source document', () => {
            expect(newSourceScope.isDone()).to.be.false;
          });
        });
      });
    });
  });

  describe('#handleTrackingError', () => {
    let errorSpy;
    let warnSpy;
    let inaccessibleContentSpy;
    let pushSpy;
    let terms;
    let app;
    const retryableError = new FetchDocumentError(FetchDocumentError.LIKELY_TRANSIENT_ERRORS[0]);

    before(async () => {
      app = await createAndInitializeArchivist();
    });

    beforeEach(() => {
      errorSpy = sinon.spy();
      warnSpy = sinon.spy();
      inaccessibleContentSpy = sinon.spy();
      pushSpy = sinon.spy(app.trackingQueue, 'push');
      app.on('error', errorSpy);
      app.on('warn', warnSpy);
      app.on('inaccessibleContent', inaccessibleContentSpy);

      terms = {
        service: { id: 'test-service' },
        type: 'test-type',
        sourceDocuments: [
          { location: 'https://example.com/doc1', content: 'test', mimeType: 'text/html' },
          { location: 'https://example.com/doc2', content: 'test', mimeType: 'text/html' },
        ],
      };
    });

    afterEach(() => {
      errorSpy.resetHistory();
      warnSpy.resetHistory();
      inaccessibleContentSpy.resetHistory();
      pushSpy.restore();
    });

    context('with an InaccessibleContentError', () => {
      context('when error may be transient', () => {
        beforeEach(() => {
          const error = new InaccessibleContentError([retryableError]);

          app.handleTrackingError(error, { terms });
        });

        it('does not emit an error event', () => {
          expect(errorSpy).to.not.have.been.called;
        });

        it('does not emit an inaccessibleContent event', () => {
          expect(inaccessibleContentSpy).to.not.have.been.called;
        });

        it('emits a warning', () => {
          expect(warnSpy).to.have.been.called;
        });

        it('pushes terms to tracking queue for retry', () => {
          expect(pushSpy).to.have.been.calledWith({ terms, isRetry: true });
        });
      });

      context('when error comes from a retry', () => {
        beforeEach(() => {
          const error = new InaccessibleContentError([retryableError]);

          app.handleTrackingError(error, { terms, isRetry: true });
        });

        it('does not emit an error event', () => {
          expect(errorSpy).to.not.have.been.called;
        });

        it('does not emit a warning', () => {
          expect(warnSpy).to.not.have.been.called;
        });

        it('emits an inaccessibleContent event with error and terms', () => {
          expect(inaccessibleContentSpy).to.have.been.called;
        });

        it('does not push terms to tracking queue for retry', () => {
          expect(pushSpy).to.not.have.been.called;
        });
      });
    });
  });

  describe('Plugin system', () => {
    const plugin = {};

    describe('#attach', () => {
      before(async () => {
        app = await createAndInitializeArchivist();

        EVENTS.forEach(event => {
          const handlerName = `on${event[0].toUpperCase()}${event.substring(1)}`;

          plugin[handlerName] = sinon.spy();
        });

        app.removeAllListeners('error');
        expect(app.eventNames()).to.be.empty;
        app.attach(plugin);
      });

      EVENTS.forEach(event => {
        const handlerName = `on${event[0].toUpperCase()}${event.substring(1)}`;

        it(`attaches plugin "${event}" handler`, () => {
          app.emit(event);
          expect(plugin[handlerName].calledOnce).to.be.true;
        });
      });
    });

    context('when errors occur within a plugin', () => {
      let error;
      let listeners;
      let plugin;

      before(async () => {
        setupNockForServices({ serviceA: true, serviceB: false });

        app = await createAndInitializeArchivist();

        plugin = { onFirstVersionRecorded: () => { throw new Error('Plugin error'); } };

        listeners = process.listeners('unhandledRejection'); // back up listeners
        process.removeAllListeners('unhandledRejection'); // remove all listeners to avoid exit the process

        process.on('unhandledRejection', reason => { error = reason; });

        app.attach(plugin);
      });

      after(async () => {
        process.removeAllListeners('unhandledRejection');
        listeners.forEach(listener => process.on('unhandledRejection', listener));
        await resetGitRepositories();
      });

      it('does not crash the tracking process', done => {
        app.track({ services: [services[0]] }).then(() => {
          if (error) {
            return done(error);
          }
          done();
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
      app = await createAndInitializeArchivist();

      EVENTS.forEach(event => {
        const handlerName = `on${event[0].toUpperCase()}${event.substr(1)}`;

        spies[handlerName] = sinon.spy();
        app.on(event, spies[handlerName]);
      });
    });

    describe('#recordSnapshot', () => {
      let terms;
      let snapshot;

      before(() => {
        terms = app.services.service·A.getTerms({ type: SERVICE_A_TYPE });
        terms.fetchDate = FETCH_DATE;
        terms.sourceDocuments.forEach(sourceDocument => {
          sourceDocument.content = serviceASnapshotExpectedContent;
          sourceDocument.mimeType = MIME_TYPE;
        });
        resetSpiesHistory();
      });

      context('when it is the first record', () => {
        before(async () => {
          snapshot = await app.recordSnapshot(terms, terms.sourceDocuments[0]);
        });

        after(() => {
          resetSpiesHistory();

          return resetGitRepositories();
        });

        it('emits "firstSnapshotRecorded" event', () => {
          expect(spies.onFirstSnapshotRecorded).to.have.been.calledWith(snapshot);
        });

        emitsOnly(['firstSnapshotRecorded']);
      });

      context('when it is not the first record', () => {
        context('when there are changes', () => {
          let changedSnapshot;

          before(async () => {
            await app.recordSnapshot(terms, terms.sourceDocuments[0]);
            resetSpiesHistory();
            terms.sourceDocuments.forEach(sourceDocument => {
              sourceDocument.content = serviceBSnapshotExpectedContent;
            });
            changedSnapshot = await app.recordSnapshot(terms, terms.sourceDocuments[0]);
          });

          after(() => {
            resetSpiesHistory();

            return resetGitRepositories();
          });

          it('emits "snapshotRecorded" event', () => {
            expect(spies.onSnapshotRecorded).to.have.been.calledWith(changedSnapshot);
          });

          emitsOnly(['snapshotRecorded']);
        });

        context('when there are no changes', () => {
          let snapshot;

          before(async () => {
            await app.recordSnapshot(terms, terms.sourceDocuments[0]);
            resetSpiesHistory();
            snapshot = await app.recordSnapshot(terms, terms.sourceDocuments[0]);
          });

          after(() => {
            resetSpiesHistory();

            return resetGitRepositories();
          });

          it('emits "snapshotNotChanged" event', () => {
            expect(spies.onSnapshotNotChanged).to.have.been.calledWith(snapshot);
          });

          emitsOnly(['snapshotNotChanged']);
        });
      });
    });

    describe('#recordVersion', () => {
      let terms;
      let version;

      before(() => {
        terms = app.services.service·A.getTerms({ type: SERVICE_A_TYPE });
        terms.fetchDate = FETCH_DATE;
        terms.sourceDocuments.forEach(sourceDocument => {
          sourceDocument.content = serviceASnapshotExpectedContent;
          sourceDocument.mimeType = MIME_TYPE;
        });
        resetSpiesHistory();
      });

      context('when it is the first record', () => {
        before(async () => {
          version = await app.recordVersion(terms, 'content');
        });

        after(() => {
          resetSpiesHistory();

          return resetGitRepositories();
        });

        it('emits "firstVersionRecorded" event', () => {
          expect(spies.onFirstVersionRecorded).to.have.been.calledWith(version);
        });

        emitsOnly(['firstVersionRecorded']);
      });

      context('when it is not the first record', () => {
        context('when there are changes', () => {
          let changedVersion;

          before(async () => {
            await app.recordVersion(terms, 'content');
            resetSpiesHistory();
            terms.sourceDocuments.forEach(sourceDocument => {
              sourceDocument.content = serviceBSnapshotExpectedContent;
            });
            changedVersion = await app.recordVersion(terms, 'content updated');
          });

          after(() => {
            resetSpiesHistory();

            return resetGitRepositories();
          });

          it('emits "versionRecorded" event', () => {
            expect(spies.onVersionRecorded).to.have.been.calledWith(changedVersion);
          });

          emitsOnly(['versionRecorded']);
        });

        context('when there are no changes', () => {
          let version;

          before(async () => {
            await app.recordVersion(terms, 'content');
            resetSpiesHistory();
            version = await app.recordVersion(terms, 'content');
          });

          after(() => {
            resetSpiesHistory();

            return resetGitRepositories();
          });

          it('emits "versionNotChanged" event', () => {
            expect(spies.onVersionNotChanged).to.have.been.calledWith(version);
          });

          emitsOnly(['versionNotChanged']);
        });
      });
    });

    context('when tracking changes on new services', () => {
      before(() => {
        nock('https://www.servicea.example').get('/tos').reply(200, serviceASnapshotExpectedContent, { 'Content-Type': 'text/html' });
        nock('https://www.serviceb.example').get('/privacy').reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });

        return app.track({ services });
      });

      after(() => {
        resetSpiesHistory();

        return resetGitRepositories();
      });

      it('emits "trackingStarted" event', () => {
        expect(spies.onTrackingStarted).to.have.been.calledOnce;
      });

      it('emits "firstSnapshotRecorded" events', () => {
        expect(spies.onFirstSnapshotRecorded).to.have.been.calledTwice;
      });

      it('emits "firstVersionRecorded" events', () => {
        expect(spies.onFirstVersionRecorded).to.have.been.calledTwice;
      });

      it('emits "firstVersionRecorded" events after "firstSnapshotRecorded" events', () => {
        expect(spies.onFirstVersionRecorded).to.have.been.calledAfter(spies.onFirstSnapshotRecorded);
      });

      it('emits "trackingCompleted" event', () => {
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

        it('emits "trackingStarted" event', () => {
          expect(spies.onTrackingStarted).to.have.been.calledOnce;
        });

        it('emits "snapshotNotChanged" events', () => {
          expect(spies.onSnapshotNotChanged).to.have.been.calledTwice;
        });

        it('emits "versionNotChanged" events', () => {
          expect(spies.onVersionNotChanged).to.have.been.calledTwice;
        });

        it('emits "versionNotChanged" events after "snapshotRecorded" events', () => {
          expect(spies.onVersionNotChanged).to.have.been.calledAfter(spies.onSnapshotNotChanged);
        });

        it('emits "trackingCompleted" event', () => {
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

        it('emits "trackingStarted" event', () => {
          expect(spies.onTrackingStarted).to.have.been.calledOnce;
        });

        it('emits "snapshotNotChanged" event for the service that was not changed', () => {
          expect(spies.onSnapshotNotChanged).to.have.been.calledOnceWith(snapshotB);
        });

        it('emits "snapshotRecorded" event for the service that was changed', () => {
          expect(spies.onSnapshotRecorded).to.have.been.calledOnceWith(snapshotA);
        });

        it('emits "versionNotChanged" events for the service that was not changed', () => {
          expect(spies.onVersionNotChanged).to.have.been.calledOnceWith(versionB);
        });

        it('emits "versionRecorded" event for the service that was changed', () => {
          expect(spies.onVersionRecorded).to.have.been.calledOnceWith(versionA);
        });

        it('emits "snapshotRecorded" events after "versionRecorded" events', () => {
          expect(spies.onVersionRecorded).to.have.been.calledAfter(spies.onSnapshotRecorded);
        });

        it('emits "trackingCompleted" event', () => {
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
