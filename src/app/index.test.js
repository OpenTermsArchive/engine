import chai from 'chai';
import { fileURLToPath } from 'url';
import fsApi from 'fs';
import nock from 'nock';
import path from 'path';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { gitSnapshot, gitVersion, resetGitRepository } from '../../test/helper.js';
import { SNAPSHOTS_PATH, VERSIONS_PATH } from './history/index.js';
import CGUs, { AVAILABLE_EVENTS } from './index.js';

const fs = fsApi.promises;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
chai.use(sinonChai);
const { expect } = chai;

describe('CGUs', () => {
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

  const serviceIds = ['service_A', 'service_B'];

  before(async () => {
    serviceASnapshotExpectedContent = await fs.readFile(
      path.resolve(__dirname, '../../test/fixtures/service_A_terms_snapshot.html'),
      { encoding: 'utf8' }
    );
    serviceAVersionExpectedContent = await fs.readFile(
      path.resolve(__dirname, '../../test/fixtures/service_A_terms.md'),
      { encoding: 'utf8' }
    );
    serviceBSnapshotExpectedContent = await fs.readFile(
      path.resolve(__dirname, '../../test/fixtures/terms.pdf')
    );
    serviceBVersionExpectedContent = await fs.readFile(
      path.resolve(__dirname, '../../test/fixtures/termsFromPDF.md'),
      { encoding: 'utf8' }
    );
  });

  describe('#trackChanges', () => {
    let app;
    before(async () => {
      nock('https://www.servicea.example')
        .get('/tos')
        .reply(200, serviceASnapshotExpectedContent, { 'Content-Type': 'text/html' });
      nock('https://www.serviceb.example')
        .get('/privacy')
        .reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });
      app = new CGUs();
      await app.init();
    });

    context('When everything works fine', () => {
      before(async () => app.trackChanges(serviceIds));

      after(resetGitRepository);

      it('records no snapshot for service A', async () => {
        const resultingSnapshotTerms = await fs.readFile(
          path.resolve(__dirname, SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH),
          { encoding: 'utf8' }
        );
        expect(resultingSnapshotTerms).to.equal(serviceASnapshotExpectedContent);
      });

      it('records no version for service A', async () => {
        const resultingTerms = await fs.readFile(
          path.resolve(__dirname, SERVICE_A_EXPECTED_VERSION_FILE_PATH),
          { encoding: 'utf8' }
        );
        expect(resultingTerms).to.equal(serviceAVersionExpectedContent);
      });

      it('records snapshot for service B', async () => {
        const resultingSnapshotTerms = await fs.readFile(
          path.resolve(__dirname, SERVICE_B_EXPECTED_SNAPSHOT_FILE_PATH)
        );
        expect(resultingSnapshotTerms.equals(serviceBSnapshotExpectedContent)).to.be.true;
      });

      it('records version for service B', async () => {
        const resultingTerms = await fs.readFile(
          path.resolve(__dirname, SERVICE_B_EXPECTED_VERSION_FILE_PATH),
          { encoding: 'utf8' }
        );
        expect(resultingTerms).to.equal(serviceBVersionExpectedContent);
      });
    });

    context('When there is an expected error', () => {
      before(async () => {
        // as there is no more HTTP request mocks for service A, it should throw an `ENOTFOUND` error which is consiedred as an expected error in our workflow
        nock.cleanAll();
        nock('https://www.serviceb.example')
          .get('/privacy')
          .reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });
        await app.trackChanges(serviceIds);
      });

      after(resetGitRepository);

      it('records no snapshot for service A', async () => {
        expect(fsApi.existsSync(path.resolve(__dirname, SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH))).to
          .be.false;
      });

      it('records no version for service A', async () => {
        expect(fsApi.existsSync(path.resolve(__dirname, SERVICE_A_EXPECTED_VERSION_FILE_PATH))).to
          .be.false;
      });

      it('still records snapshot for service B', async () => {
        const resultingSnapshotTerms = await fs.readFile(
          path.resolve(__dirname, SERVICE_B_EXPECTED_SNAPSHOT_FILE_PATH)
        );
        expect(resultingSnapshotTerms.equals(serviceBSnapshotExpectedContent)).to.be.true;
      });

      it('still records version for service B', async () => {
        const resultingTerms = await fs.readFile(
          path.resolve(__dirname, SERVICE_B_EXPECTED_VERSION_FILE_PATH),
          { encoding: 'utf8' }
        );
        expect(resultingTerms).to.equal(serviceBVersionExpectedContent);
      });
    });
  });

  describe('#refilterAndRecord', () => {
    context('When a service’s filter declaration changes', () => {
      context('When everything works fine', () => {
        let originalSnapshotId;
        let firstVersionId;
        let refilterVersionId;
        let refilterVersionMessageBody;
        let serviceBCommits;

        before(async () => {
          nock('https://www.servicea.example')
            .get('/tos')
            .reply(200, serviceASnapshotExpectedContent, { 'Content-Type': 'text/html' });
          nock('https://www.serviceb.example')
            .get('/privacy')
            .reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });
          const app = new CGUs();
          await app.init();
          await app.trackChanges(serviceIds);

          const [originalSnapshotCommit] = await gitSnapshot().log({
            file: SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH,
          });
          originalSnapshotId = originalSnapshotCommit.hash;

          const [firstVersionCommit] = await gitVersion().log({
            file: SERVICE_A_EXPECTED_VERSION_FILE_PATH,
          });
          firstVersionId = firstVersionCommit.hash;

          serviceBCommits = await gitVersion().log({ file: SERVICE_B_EXPECTED_VERSION_FILE_PATH });

          app.serviceDeclarations[SERVICE_A_ID].getDocumentDeclaration(
            SERVICE_A_TYPE
          ).contentSelectors = 'h1';

          await app.refilterAndRecord(['service_A', 'service_B']);

          const [refilterVersionCommit] = await gitVersion().log({
            file: SERVICE_A_EXPECTED_VERSION_FILE_PATH,
          });
          refilterVersionId = refilterVersionCommit.hash;
          refilterVersionMessageBody = refilterVersionCommit.body;
        });

        after(resetGitRepository);

        it('refilters the changed service', async () => {
          const serviceAContent = await fs.readFile(
            path.resolve(__dirname, SERVICE_A_EXPECTED_VERSION_FILE_PATH),
            { encoding: 'utf8' }
          );
          expect(serviceAContent).to.equal(
            'Terms of service with UTF-8 \'çhãràčtęrs"\n========================================'
          );
        });

        it('generates a new version id', async () => {
          expect(refilterVersionId).to.not.equal(firstVersionId);
        });

        it('mentions the snapshot id in the changelog', async () => {
          expect(refilterVersionMessageBody).to.include(originalSnapshotId);
        });

        it('does not change other services', async () => {
          const serviceBVersion = await fs.readFile(
            path.resolve(__dirname, SERVICE_B_EXPECTED_VERSION_FILE_PATH),
            { encoding: 'utf8' }
          );
          expect(serviceBVersion).to.equal(serviceBVersionExpectedContent);
        });

        it('does not generate a new id for other services', async () => {
          const serviceBCommitsAfterRefiltering = await gitVersion().log({
            file: SERVICE_B_EXPECTED_VERSION_FILE_PATH,
          });
          expect(serviceBCommitsAfterRefiltering.map((commit) => commit.hash)).to.deep.equal(
            serviceBCommits.map((commit) => commit.hash)
          );
        });
      });

      context('When there is an expected error', () => {
        let inaccessibleContentSpy;
        let versionNotChangedSpy;
        before(async () => {
          nock('https://www.servicea.example')
            .get('/tos')
            .reply(200, serviceASnapshotExpectedContent, { 'Content-Type': 'text/html' });
          nock('https://www.serviceb.example')
            .get('/privacy')
            .reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });
          const app = new CGUs();
          await app.init();
          await app.trackChanges(serviceIds);

          app.serviceDeclarations[SERVICE_A_ID].getDocumentDeclaration(
            SERVICE_A_TYPE
          ).contentSelectors = 'inexistant-selector';
          inaccessibleContentSpy = sinon.spy();
          versionNotChangedSpy = sinon.spy();
          app.on('inaccessibleContent', inaccessibleContentSpy);
          app.on('versionNotChanged', versionNotChangedSpy);
          await app.refilterAndRecord(serviceIds);
        });

        after(resetGitRepository);

        it('emits an inaccessibleContent event when an error happens during refiltering', async () => {
          expect(inaccessibleContentSpy).to.have.been.called;
        });

        it('still refilters other services', async () => {
          expect(versionNotChangedSpy).to.have.been.calledWith(SERVICE_B_ID, SERVICE_B_TYPE);
        });
      });
    });
  });

  describe('events', () => {
    const spies = {};
    let app;
    let documentADeclaration;

    function resetSpiesHistory() {
      Object.keys(spies).forEach((spyName) => spies[spyName].resetHistory());
    }

    function emitsOnly(eventNames) {
      AVAILABLE_EVENTS.filter((el) => eventNames.indexOf(el) < 0).forEach((event) => {
        const handlerName = `on${event[0].toUpperCase()}${event.substr(1)}`;
        it(`emits no "${event}" event`, () => {
          expect(spies[handlerName]).to.have.not.been.called;
        });
      });
    }

    before(async () => {
      app = new CGUs();
      await app.init();

      AVAILABLE_EVENTS.forEach((event) => {
        const handlerName = `on${event[0].toUpperCase()}${event.substr(1)}`;
        spies[handlerName] = sinon.spy();
        app.on(event, spies[handlerName]);
      });

      documentADeclaration = app.serviceDeclarations[SERVICE_A_ID].getDocumentDeclaration(
        SERVICE_A_TYPE
      );
    });

    describe('#recordSnapshot', () => {
      context('When it is the first record', () => {
        before(async () =>
          app.recordSnapshot({
            content: 'document content',
            documentDeclaration: documentADeclaration,
          }));

        after(() => {
          resetSpiesHistory();
          return resetGitRepository();
        });

        it('emits "firstSnapshotRecorded" event', async () => {
          expect(spies.onFirstSnapshotRecorded).to.have.been.calledWith(
            SERVICE_A_ID,
            SERVICE_A_TYPE
          );
        });

        emitsOnly(['firstSnapshotRecorded']);
      });

      context('When it is not the first record', () => {
        context('When there are changes', () => {
          before(async () => {
            await app.recordSnapshot({
              content: 'document content',
              documentDeclaration: documentADeclaration,
            });
            resetSpiesHistory();
            await app.recordSnapshot({
              content: 'document content modified',
              documentDeclaration: documentADeclaration,
            });
          });

          after(() => {
            resetSpiesHistory();
            return resetGitRepository();
          });

          it('emits "snapshotRecorded" event', async () => {
            expect(spies.onSnapshotRecorded).to.have.been.calledWith(SERVICE_A_ID, SERVICE_A_TYPE);
          });

          emitsOnly(['snapshotRecorded']);
        });

        context('When there are no changes', () => {
          before(async () => {
            await app.recordSnapshot({
              content: 'document content',
              documentDeclaration: documentADeclaration,
            });
            resetSpiesHistory();
            await app.recordSnapshot({
              content: 'document content',
              documentDeclaration: documentADeclaration,
            });
          });

          after(() => {
            resetSpiesHistory();
            return resetGitRepository();
          });

          it('emits "snapshotNotChanged" event', async () => {
            expect(spies.onSnapshotNotChanged).to.have.been.calledWith(
              SERVICE_A_ID,
              SERVICE_A_TYPE
            );
          });

          emitsOnly(['snapshotNotChanged']);
        });
      });
    });

    describe('#recordVersion', () => {
      context('When it is the first record', () => {
        before(async () =>
          app.recordVersion({
            snapshotContent: serviceASnapshotExpectedContent,
            snapshotId: 'sha',
            documentDeclaration: documentADeclaration,
          }));

        after(() => {
          resetSpiesHistory();
          return resetGitRepository();
        });

        it('emits "firstVersionRecorded" event', async () => {
          expect(spies.onFirstVersionRecorded).to.have.been.calledWith(
            SERVICE_A_ID,
            SERVICE_A_TYPE
          );
        });

        emitsOnly(['firstVersionRecorded']);
      });

      context('When it is not the first record', () => {
        context('When there are changes', () => {
          before(async () => {
            await app.recordVersion({
              snapshotContent: serviceASnapshotExpectedContent,
              snapshotId: 'sha',
              documentDeclaration: documentADeclaration,
            });
            resetSpiesHistory();
            await app.recordVersion({
              snapshotContent: serviceBSnapshotExpectedContent,
              snapshotId: 'sha',
              documentDeclaration: documentADeclaration,
            });
          });

          after(() => {
            resetSpiesHistory();
            return resetGitRepository();
          });

          it('emits "versionRecorded" event', async () => {
            expect(spies.onVersionRecorded).to.have.been.calledWith(SERVICE_A_ID, SERVICE_A_TYPE);
          });

          emitsOnly(['versionRecorded']);
        });

        context('When there are no changes', () => {
          before(async () => {
            await app.recordVersion({
              snapshotContent: serviceASnapshotExpectedContent,
              snapshotId: 'sha',
              documentDeclaration: documentADeclaration,
            });
            resetSpiesHistory();
            await app.recordVersion({
              snapshotContent: serviceASnapshotExpectedContent,
              snapshotId: 'sha',
              documentDeclaration: documentADeclaration,
            });
          });

          after(() => {
            resetSpiesHistory();
            return resetGitRepository();
          });

          it('emits "versionNotChanged" event', async () => {
            expect(spies.onVersionNotChanged).to.have.been.calledWith(SERVICE_A_ID, SERVICE_A_TYPE);
          });

          emitsOnly(['versionNotChanged']);
        });
      });
    });

    context('When tracking changes on new services', () => {
      before(async () => {
        nock('https://www.servicea.example')
          .get('/tos')
          .reply(200, serviceASnapshotExpectedContent, { 'Content-Type': 'text/html' });
        nock('https://www.serviceb.example')
          .get('/privacy')
          .reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });

        return app.trackChanges(serviceIds);
      });

      after(() => {
        resetSpiesHistory();
        return resetGitRepository();
      });

      it('emits "firstSnapshotRecorded" events', async () => {
        expect(spies.onFirstSnapshotRecorded).to.have.been.calledTwice;
      });

      it('emits "firstVersionRecorded" events', async () => {
        expect(spies.onFirstVersionRecorded).to.have.been.calledTwice;
      });

      it('emits "firstVersionRecorded" events after "firstSnapshotRecorded" events', async () => {
        expect(spies.onFirstVersionRecorded).to.have.been.calledAfter(
          spies.onFirstSnapshotRecorded
        );
      });

      emitsOnly(['firstSnapshotRecorded', 'onFirstSnapshotRecorded', 'firstVersionRecorded']);
    });

    context('When tracking changes on already tracked services', () => {
      context('When services did not change', () => {
        before(async () => {
          nock('https://www.servicea.example')
            .get('/tos')
            .reply(200, serviceASnapshotExpectedContent, { 'Content-Type': 'text/html' });
          nock('https://www.serviceb.example')
            .get('/privacy')
            .reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });

          await app.trackChanges(serviceIds);

          nock('https://www.servicea.example')
            .get('/tos')
            .reply(200, serviceASnapshotExpectedContent, { 'Content-Type': 'text/html' });
          nock('https://www.serviceb.example')
            .get('/privacy')
            .reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });

          resetSpiesHistory();
          return app.trackChanges(serviceIds);
        });

        after(() => {
          resetSpiesHistory();
          return resetGitRepository();
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

        emitsOnly(['snapshotNotChanged', 'versionNotChanged', 'snapshotRecorded']);
      });

      context('When a service changed', () => {
        before(async () => {
          nock('https://www.servicea.example')
            .get('/tos')
            .reply(200, serviceASnapshotExpectedContent, { 'Content-Type': 'text/html' });
          nock('https://www.serviceb.example')
            .get('/privacy')
            .reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });

          await app.trackChanges(serviceIds);

          nock('https://www.servicea.example')
            .get('/tos')
            .reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'text/html' });
          nock('https://www.serviceb.example')
            .get('/privacy')
            .reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });

          resetSpiesHistory();
          await app.trackChanges(serviceIds);
        });

        after(() => {
          resetSpiesHistory();
          return resetGitRepository();
        });

        it('emits "snapshotNotChanged" events', async () => {
          expect(spies.onSnapshotNotChanged).to.have.been.calledOnceWith(
            SERVICE_B_ID,
            SERVICE_B_TYPE
          );
        });

        it('emits "snapshotRecorded" event for service which changed', async () => {
          expect(spies.onSnapshotRecorded).to.have.been.calledOnceWith(
            SERVICE_A_ID,
            SERVICE_A_TYPE
          );
        });

        it('emits "versionNotChanged" events', async () => {
          expect(spies.onVersionNotChanged).to.have.been.calledOnceWith(
            SERVICE_B_ID,
            SERVICE_B_TYPE
          );
        });

        it('emits "versionRecorded" event for service which changed', async () => {
          expect(spies.onVersionRecorded).to.have.been.calledOnceWith(SERVICE_A_ID, SERVICE_A_TYPE);
        });

        it('emits "snapshotRecorded" events after "versionRecorded" events', async () => {
          expect(spies.onVersionRecorded).to.have.been.calledAfter(spies.onSnapshotRecorded);
        });

        emitsOnly([
          'snapshotNotChanged',
          'snapshotRecorded',
          'versionNotChanged',
          'versionRecorded',
        ]);
      });
    });
  });
});
