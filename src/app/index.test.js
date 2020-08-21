import chai from 'chai';
import fsApi from 'fs';
import path from 'path';
import nock from 'nock';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import CGUs, { AVAILABLE_EVENTS } from './index.js';
import { SNAPSHOTS_PATH, VERSIONS_PATH } from './history/index.js';
import { resetGitRepository, gitVersion, gitSnapshot } from '../../test/helper.js';

const fs = fsApi.promises;
const __dirname = path.dirname(new URL(import.meta.url).pathname);
chai.use(sinonChai);
const { expect } = chai;

const SERVICE_A_ID = 'service_A';
const SERVICE_A_TYPE = 'Terms of Service';
const SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH = `${SNAPSHOTS_PATH}/${SERVICE_A_ID}/${SERVICE_A_TYPE}.html`;
const SERVICE_A_EXPECTED_VERSION_FILE_PATH = `${VERSIONS_PATH}/${SERVICE_A_ID}/${SERVICE_A_TYPE}.md`;
const SERVICE_A_TOS_SNAPSHOT = fsApi.readFileSync(path.resolve(__dirname, '../../test/fixtures/service_A_terms_snapshot.html'), { encoding: 'utf8' });
const SERVICE_A_TOS_VERSION = fsApi.readFileSync(path.resolve(__dirname, '../../test/fixtures/service_A_terms.md'), { encoding: 'utf8' });

const SERVICE_B_ID = 'service_B';
const SERVICE_B_TYPE = 'Privacy Policy';
const SERVICE_B_EXPECTED_SNAPSHOT_FILE_PATH = `${SNAPSHOTS_PATH}/${SERVICE_B_ID}/${SERVICE_B_TYPE}.html`;
const SERVICE_B_EXPECTED_VERSION_FILE_PATH = `${VERSIONS_PATH}/${SERVICE_B_ID}/${SERVICE_B_TYPE}.md`;
const SERVICE_B_TOS_SNAPSHOT = fsApi.readFileSync(path.resolve(__dirname, '../../test/fixtures/service_B_terms_snapshot.html'), { encoding: 'utf8' });
const SERVICE_B_TOS_VERSION = fsApi.readFileSync(path.resolve(__dirname, '../../test/fixtures/service_B_terms.md'), { encoding: 'utf8' });

describe('CGUs', () => {
  describe('#trackChanges', () => {
    before(async () => {
      nock('https://www.servicea.example').get('/tos').reply(200, SERVICE_A_TOS_SNAPSHOT);
      nock('https://www.serviceb.example').get('/tos').reply(200, SERVICE_B_TOS_SNAPSHOT);
      const app = new CGUs();
      await app.init();
      return app.trackChanges();
    });

    after(resetGitRepository);

    it('records snapshot for service A', async () => {
      const resultingSnapshotTerms = await fs.readFile(path.resolve(__dirname, SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH), { encoding: 'utf8' });
      expect(resultingSnapshotTerms).to.be.equal(SERVICE_A_TOS_SNAPSHOT);
    });

    it('records version for service A', async () => {
      const resultingTerms = await fs.readFile(path.resolve(__dirname, SERVICE_A_EXPECTED_VERSION_FILE_PATH), { encoding: 'utf8' });
      expect(resultingTerms).to.be.equal(SERVICE_A_TOS_VERSION);
    });

    it('records snapshot for service B', async () => {
      const resultingSnapshotTerms = await fs.readFile(path.resolve(__dirname, SERVICE_B_EXPECTED_SNAPSHOT_FILE_PATH), { encoding: 'utf8' });
      expect(resultingSnapshotTerms).to.be.equal(SERVICE_B_TOS_SNAPSHOT);
    });

    it('records version for service B', async () => {
      const resultingTerms = await fs.readFile(path.resolve(__dirname, SERVICE_B_EXPECTED_VERSION_FILE_PATH), { encoding: 'utf8' });
      expect(resultingTerms).to.be.equal(SERVICE_B_TOS_VERSION);
    });
  });

  describe('#refilterAndRecord', () => {
    context('When a service’s filter declaration changes', () => {
      let originalSnapshotId;
      let firstVersionId;
      let refilterVersionId;
      let refilterVersionMessageBody;
      let serviceBCommits;

      before(async () => {
        nock('https://www.servicea.example').get('/tos').reply(200, SERVICE_A_TOS_SNAPSHOT);
        nock('https://www.serviceb.example').get('/tos').reply(200, SERVICE_B_TOS_SNAPSHOT);
        const app = new CGUs();
        await app.init();
        await app.trackChanges();

        const [ originalSnapshotCommit ] = await gitSnapshot().log({ file: SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH });
        originalSnapshotId = originalSnapshotCommit.hash;

        const [ firstVersionCommit ] = await gitVersion().log({ file: SERVICE_A_EXPECTED_VERSION_FILE_PATH });
        firstVersionId = firstVersionCommit.hash;

        serviceBCommits = await gitVersion().log({ file: SERVICE_B_EXPECTED_VERSION_FILE_PATH });

        app.serviceDeclarations[SERVICE_A_ID].documents[SERVICE_A_TYPE].select = 'h1';

        await app.refilterAndRecord();

        const [ refilterVersionCommit ] = await gitVersion().log({ file: SERVICE_A_EXPECTED_VERSION_FILE_PATH });
        refilterVersionId = refilterVersionCommit.hash;
        refilterVersionMessageBody = refilterVersionCommit.body;
      });

      after(resetGitRepository);

      it('refilters the content and saves the file', async () => {
        const serviceAContent = await fs.readFile(path.resolve(__dirname, SERVICE_A_EXPECTED_VERSION_FILE_PATH), { encoding: 'utf8' });
        expect(serviceAContent).to.be.equal('Terms of service A\n==================');
      });

      it('generates a new version id', async () => {
        expect(refilterVersionId).to.not.equal(firstVersionId);
      });

      it('mentions the snapshot id in the changelog', async () => {
        expect(refilterVersionMessageBody).to.include(originalSnapshotId);
      });

      it('does not change other services', async () => {
        const serviceBVersion = await fs.readFile(path.resolve(__dirname, SERVICE_B_EXPECTED_VERSION_FILE_PATH), { encoding: 'utf8' });
        expect(serviceBVersion).to.be.equal(SERVICE_B_TOS_VERSION);
      });

      it('does not generate a new id for other services', async () => {
        const serviceBCommitsAfterRefiltering = await gitVersion().log({ file: SERVICE_B_EXPECTED_VERSION_FILE_PATH });
        expect(serviceBCommitsAfterRefiltering.map(commit => commit.hash)).to.deep.equal(serviceBCommits.map(commit => commit.hash));
      });
    });
  });

  describe('events', () => {
    const spies = {};
    let app;
    let documentADeclaration;

    function resetSpiesHistory() {
      Object.keys(spies).forEach(spyName => spies[spyName].resetHistory());
    }

    before(async () => {
      app = new CGUs();
      await app.init();

      AVAILABLE_EVENTS.forEach(event => {
        const handlerName = `on${event[0].toUpperCase()}${event.substr(1)}`;
        spies[handlerName] = sinon.spy();
        app.on(event, spies[handlerName]);
      });

      documentADeclaration = {
        type: SERVICE_A_TYPE,
        ...app.serviceDeclarations[SERVICE_A_ID].documents[SERVICE_A_TYPE]
      };
    });

    describe('#recordSnapshot', () => {
      context('When it is the first record', () => {
        before(async () => app.recordSnapshot({ content: 'document content', serviceId: SERVICE_A_ID, type: SERVICE_A_TYPE }));

        after(() => {
          resetSpiesHistory();
          return resetGitRepository();
        });

        it('emits "onFirstSnapshotRecorded" event', async () => {
          expect(spies.onFirstSnapshotRecorded).to.have.been.calledWith(SERVICE_A_ID, SERVICE_A_TYPE);
        });

        it('emits no other events', async () => {
          expect(spies.onStartTrackingChanges).to.have.not.been.called;
          expect(spies.onEndTrackingChanges).to.have.not.been.called;
          expect(spies.onStartRefiltering).to.have.not.been.called;
          expect(spies.onEndRefiltering).to.have.not.been.called;
          expect(spies.onSnapshotRecorded).to.have.not.been.called;
          expect(spies.onNoSnapshotChanges).to.have.not.been.called;
          expect(spies.onFirstVersionRecorded).to.have.not.been.called;
          expect(spies.onVersionRecorded).to.have.not.been.called;
          expect(spies.onNoVersionChanges).to.have.not.been.called;
          expect(spies.onChangesPublished).to.have.not.been.called;
          expect(spies.onApplicationError).to.have.not.been.called;
          expect(spies.onRecordRefilterError).to.have.not.been.called;
          expect(spies.onDocumentUpdateError).to.have.not.been.called;
          expect(spies.onDocumentFetchError).to.have.not.been.called;
        });
      });

      context('When it is not the first record', () => {
        context('When there are changes', () => {
          before(async () => {
            await app.recordSnapshot({ content: 'document content', serviceId: SERVICE_A_ID, type: SERVICE_A_TYPE });
            resetSpiesHistory();
            await app.recordSnapshot({ content: 'document content modified', serviceId: SERVICE_A_ID, type: SERVICE_A_TYPE });
          });

          after(() => {
            resetSpiesHistory();
            return resetGitRepository();
          });

          it('emits "onSnapshotRecorded" event', async () => {
            expect(spies.onSnapshotRecorded).to.have.been.calledWith(SERVICE_A_ID, SERVICE_A_TYPE);
          });

          it('emits no other events', async () => {
            expect(spies.onStartTrackingChanges).to.have.not.been.called;
            expect(spies.onEndTrackingChanges).to.have.not.been.called;
            expect(spies.onStartRefiltering).to.have.not.been.called;
            expect(spies.onEndRefiltering).to.have.not.been.called;
            expect(spies.onFirstSnapshotRecorded).to.have.not.been.called;
            expect(spies.onNoSnapshotChanges).to.have.not.been.called;
            expect(spies.onFirstVersionRecorded).to.have.not.been.called;
            expect(spies.onVersionRecorded).to.have.not.been.called;
            expect(spies.onNoVersionChanges).to.have.not.been.called;
            expect(spies.onChangesPublished).to.have.not.been.called;
            expect(spies.onApplicationError).to.have.not.been.called;
            expect(spies.onRecordRefilterError).to.have.not.been.called;
            expect(spies.onDocumentUpdateError).to.have.not.been.called;
            expect(spies.onDocumentFetchError).to.have.not.been.called;
          });
        });

        context('When there are no changes', () => {
          before(async () => {
            await app.recordSnapshot({ content: 'document content', serviceId: SERVICE_A_ID, type: SERVICE_A_TYPE });
            resetSpiesHistory();
            await app.recordSnapshot({ content: 'document content', serviceId: SERVICE_A_ID, type: SERVICE_A_TYPE });
          });

          after(() => {
            resetSpiesHistory();
            return resetGitRepository();
          });

          it('emits "onNoSnapshotChanges" event', async () => {
            expect(spies.onNoSnapshotChanges).to.have.been.calledWith(SERVICE_A_ID, SERVICE_A_TYPE);
          });

          it('emits no other events', async () => {
            expect(spies.onStartTrackingChanges).to.have.not.been.called;
            expect(spies.onEndTrackingChanges).to.have.not.been.called;
            expect(spies.onStartRefiltering).to.have.not.been.called;
            expect(spies.onEndRefiltering).to.have.not.been.called;
            expect(spies.onFirstSnapshotRecorded).to.have.not.been.called;
            expect(spies.onSnapshotRecorded).to.have.not.been.called;
            expect(spies.onFirstVersionRecorded).to.have.not.been.called;
            expect(spies.onVersionRecorded).to.have.not.been.called;
            expect(spies.onNoVersionChanges).to.have.not.been.called;
            expect(spies.onChangesPublished).to.have.not.been.called;
            expect(spies.onApplicationError).to.have.not.been.called;
            expect(spies.onRecordRefilterError).to.have.not.been.called;
            expect(spies.onDocumentUpdateError).to.have.not.been.called;
            expect(spies.onDocumentFetchError).to.have.not.been.called;
          });
        });
      });
    });

    describe('#recordVersion', () => {
      context('When it is the first record', () => {
        before(async () => app.recordVersion({ snapshotContent: SERVICE_A_TOS_SNAPSHOT, snapshotId: 'sha', serviceId: SERVICE_A_ID, documentDeclaration: documentADeclaration }));

        after(() => {
          resetSpiesHistory();
          return resetGitRepository();
        });

        it('emits "onFirstVersionRecorded" event', async () => {
          expect(spies.onFirstVersionRecorded).to.have.been.calledWith(SERVICE_A_ID, SERVICE_A_TYPE);
        });

        it('emits no other events', async () => {
          expect(spies.onStartTrackingChanges).to.have.not.been.called;
          expect(spies.onEndTrackingChanges).to.have.not.been.called;
          expect(spies.onStartRefiltering).to.have.not.been.called;
          expect(spies.onEndRefiltering).to.have.not.been.called;
          expect(spies.onSnapshotRecorded).to.have.not.been.called;
          expect(spies.onNoSnapshotChanges).to.have.not.been.called;
          expect(spies.onFirstSnapshotRecorded).to.have.not.been.called;
          expect(spies.onVersionRecorded).to.have.not.been.called;
          expect(spies.onNoVersionChanges).to.have.not.been.called;
          expect(spies.onChangesPublished).to.have.not.been.called;
          expect(spies.onApplicationError).to.have.not.been.called;
          expect(spies.onRecordRefilterError).to.have.not.been.called;
          expect(spies.onDocumentUpdateError).to.have.not.been.called;
          expect(spies.onDocumentFetchError).to.have.not.been.called;
        });
      });

      context('When it is not the first record', () => {
        context('When there are changes', () => {
          before(async () => {
            await app.recordVersion({ snapshotContent: SERVICE_A_TOS_SNAPSHOT, snapshotId: 'sha', serviceId: SERVICE_A_ID, documentDeclaration: documentADeclaration });
            resetSpiesHistory();
            await app.recordVersion({ snapshotContent: SERVICE_B_TOS_SNAPSHOT, snapshotId: 'sha', serviceId: SERVICE_A_ID, documentDeclaration: documentADeclaration });
          });

          after(() => {
            resetSpiesHistory();
            return resetGitRepository();
          });

          it('emits "onVersionRecorded" event', async () => {
            expect(spies.onVersionRecorded).to.have.been.calledWith(SERVICE_A_ID, SERVICE_A_TYPE);
          });

          it('emits no other events', async () => {
            expect(spies.onStartTrackingChanges).to.have.not.been.called;
            expect(spies.onEndTrackingChanges).to.have.not.been.called;
            expect(spies.onStartRefiltering).to.have.not.been.called;
            expect(spies.onEndRefiltering).to.have.not.been.called;
            expect(spies.onFirstSnapshotRecorded).to.have.not.been.called;
            expect(spies.onNoSnapshotChanges).to.have.not.been.called;
            expect(spies.onFirstVersionRecorded).to.have.not.been.called;
            expect(spies.onSnapshotRecorded).to.have.not.been.called;
            expect(spies.onNoVersionChanges).to.have.not.been.called;
            expect(spies.onChangesPublished).to.have.not.been.called;
            expect(spies.onApplicationError).to.have.not.been.called;
            expect(spies.onRecordRefilterError).to.have.not.been.called;
            expect(spies.onDocumentUpdateError).to.have.not.been.called;
            expect(spies.onDocumentFetchError).to.have.not.been.called;
          });
        });

        context('When there are no changes', () => {
          before(async () => {
            await app.recordVersion({ snapshotContent: SERVICE_A_TOS_SNAPSHOT, snapshotId: 'sha', serviceId: SERVICE_A_ID, documentDeclaration: documentADeclaration });
            resetSpiesHistory();
            await app.recordVersion({ snapshotContent: SERVICE_A_TOS_SNAPSHOT, snapshotId: 'sha', serviceId: SERVICE_A_ID, documentDeclaration: documentADeclaration });
          });

          after(() => {
            resetSpiesHistory();
            return resetGitRepository();
          });

          it('emits "onNoVersionChanges" event', async () => {
            expect(spies.onNoVersionChanges).to.have.been.calledWith(SERVICE_A_ID, SERVICE_A_TYPE);
          });

          it('emits no other events', async () => {
            expect(spies.onStartTrackingChanges).to.have.not.been.called;
            expect(spies.onEndTrackingChanges).to.have.not.been.called;
            expect(spies.onStartRefiltering).to.have.not.been.called;
            expect(spies.onEndRefiltering).to.have.not.been.called;
            expect(spies.onFirstSnapshotRecorded).to.have.not.been.called;
            expect(spies.onSnapshotRecorded).to.have.not.been.called;
            expect(spies.onFirstVersionRecorded).to.have.not.been.called;
            expect(spies.onVersionRecorded).to.have.not.been.called;
            expect(spies.onNoSnapshotChanges).to.have.not.been.called;
            expect(spies.onChangesPublished).to.have.not.been.called;
            expect(spies.onApplicationError).to.have.not.been.called;
            expect(spies.onRecordRefilterError).to.have.not.been.called;
            expect(spies.onDocumentUpdateError).to.have.not.been.called;
            expect(spies.onDocumentFetchError).to.have.not.been.called;
          });
        });
      });
    });

    describe('#recordRefilter', () => {
      context('When it is the first record', () => {
        before(async () => app.recordRefilter({ snapshotContent: SERVICE_A_TOS_SNAPSHOT, snapshotId: 'sha', serviceId: SERVICE_A_ID, documentDeclaration: documentADeclaration }));

        after(() => {
          resetSpiesHistory();
          return resetGitRepository();
        });

        it('emits "onFirstVersionRecorded" event', async () => {
          expect(spies.onFirstVersionRecorded).to.have.been.calledWith(SERVICE_A_ID, SERVICE_A_TYPE);
        });

        it('emits no other events', async () => {
          expect(spies.onStartTrackingChanges).to.have.not.been.called;
          expect(spies.onEndTrackingChanges).to.have.not.been.called;
          expect(spies.onStartRefiltering).to.have.not.been.called;
          expect(spies.onEndRefiltering).to.have.not.been.called;
          expect(spies.onSnapshotRecorded).to.have.not.been.called;
          expect(spies.onNoSnapshotChanges).to.have.not.been.called;
          expect(spies.onFirstSnapshotRecorded).to.have.not.been.called;
          expect(spies.onVersionRecorded).to.have.not.been.called;
          expect(spies.onNoVersionChanges).to.have.not.been.called;
          expect(spies.onChangesPublished).to.have.not.been.called;
          expect(spies.onApplicationError).to.have.not.been.called;
          expect(spies.onRecordRefilterError).to.have.not.been.called;
          expect(spies.onDocumentUpdateError).to.have.not.been.called;
          expect(spies.onDocumentFetchError).to.have.not.been.called;
        });
      });

      context('When it is not the first record', () => {
        context('When there are changes', () => {
          before(async () => {
            await app.recordRefilter({ snapshotContent: SERVICE_A_TOS_SNAPSHOT, snapshotId: 'sha', serviceId: SERVICE_A_ID, documentDeclaration: documentADeclaration });
            resetSpiesHistory();
            await app.recordRefilter({ snapshotContent: SERVICE_B_TOS_SNAPSHOT, snapshotId: 'sha', serviceId: SERVICE_A_ID, documentDeclaration: documentADeclaration });
          });

          after(() => {
            resetSpiesHistory();
            return resetGitRepository();
          });

          it('emits "onVersionRecorded" event', async () => {
            expect(spies.onVersionRecorded).to.have.been.calledWith(SERVICE_A_ID, SERVICE_A_TYPE);
          });

          it('emits no other events', async () => {
            expect(spies.onStartTrackingChanges).to.have.not.been.called;
            expect(spies.onEndTrackingChanges).to.have.not.been.called;
            expect(spies.onStartRefiltering).to.have.not.been.called;
            expect(spies.onEndRefiltering).to.have.not.been.called;
            expect(spies.onFirstSnapshotRecorded).to.have.not.been.called;
            expect(spies.onNoSnapshotChanges).to.have.not.been.called;
            expect(spies.onFirstVersionRecorded).to.have.not.been.called;
            expect(spies.onSnapshotRecorded).to.have.not.been.called;
            expect(spies.onNoVersionChanges).to.have.not.been.called;
            expect(spies.onChangesPublished).to.have.not.been.called;
            expect(spies.onApplicationError).to.have.not.been.called;
            expect(spies.onRecordRefilterError).to.have.not.been.called;
            expect(spies.onDocumentUpdateError).to.have.not.been.called;
            expect(spies.onDocumentFetchError).to.have.not.been.called;
          });
        });

        context('When there are no changes', () => {
          before(async () => {
            await app.recordRefilter({ snapshotContent: SERVICE_A_TOS_SNAPSHOT, snapshotId: 'sha', serviceId: SERVICE_A_ID, documentDeclaration: documentADeclaration });
            resetSpiesHistory();
            await app.recordRefilter({ snapshotContent: SERVICE_A_TOS_SNAPSHOT, snapshotId: 'sha', serviceId: SERVICE_A_ID, documentDeclaration: documentADeclaration });
          });

          after(() => {
            resetSpiesHistory();
            return resetGitRepository();
          });

          it('emits "onNoVersionChanges" event', async () => {
            expect(spies.onNoVersionChanges).to.have.been.calledWith(SERVICE_A_ID, SERVICE_A_TYPE);
          });

          it('emits no other events', async () => {
            expect(spies.onStartTrackingChanges).to.have.not.been.called;
            expect(spies.onEndTrackingChanges).to.have.not.been.called;
            expect(spies.onStartRefiltering).to.have.not.been.called;
            expect(spies.onEndRefiltering).to.have.not.been.called;
            expect(spies.onFirstSnapshotRecorded).to.have.not.been.called;
            expect(spies.onSnapshotRecorded).to.have.not.been.called;
            expect(spies.onFirstVersionRecorded).to.have.not.been.called;
            expect(spies.onVersionRecorded).to.have.not.been.called;
            expect(spies.onNoSnapshotChanges).to.have.not.been.called;
            expect(spies.onChangesPublished).to.have.not.been.called;
            expect(spies.onApplicationError).to.have.not.been.called;
            expect(spies.onRecordRefilterError).to.have.not.been.called;
            expect(spies.onDocumentUpdateError).to.have.not.been.called;
            expect(spies.onDocumentFetchError).to.have.not.been.called;
          });
        });
      });
    });

    describe('#fetch', () => {
      after(() => {
        resetSpiesHistory();
        return resetGitRepository();
      });

      context('When everything is ok', () => {
        before(async () => {
          nock('https://www.servicea.example').get('/tos').reply(200, SERVICE_A_TOS_SNAPSHOT);

          const { fetch: location } = app.serviceDeclarations[SERVICE_A_ID].documents[SERVICE_A_TYPE];

          return app.fetch({ location, serviceId: SERVICE_A_ID, type: SERVICE_A_TYPE });
        });

        it('emits no events', async () => {
          expect(spies.onStartTrackingChanges).to.have.not.been.called;
          expect(spies.onEndTrackingChanges).to.have.not.been.called;
          expect(spies.onStartRefiltering).to.have.not.been.called;
          expect(spies.onEndRefiltering).to.have.not.been.called;
          expect(spies.onFirstSnapshotRecorded).to.have.not.been.called;
          expect(spies.onSnapshotRecorded).to.have.not.been.called;
          expect(spies.onNoSnapshotChanges).to.have.not.been.called;
          expect(spies.onFirstVersionRecorded).to.have.not.been.called;
          expect(spies.onVersionRecorded).to.have.not.been.called;
          expect(spies.onNoVersionChanges).to.have.not.been.called;
          expect(spies.onChangesPublished).to.have.not.been.called;
          expect(spies.onApplicationError).to.have.not.been.called;
          expect(spies.onRecordRefilterError).to.have.not.been.called;
          expect(spies.onDocumentUpdateError).to.have.not.been.called;
          expect(spies.onDocumentFetchError).to.have.not.been.called;
        });
      });

      context('When url cannot be fetched', () => {
        before(async () => {
          const { fetch: location } = app.serviceDeclarations[SERVICE_A_ID].documents[SERVICE_A_TYPE];

          return app.fetch({ location, serviceId: SERVICE_A_ID, type: SERVICE_A_TYPE });
        });

        it('emits "documentFetchError" event', async () => {
          expect(spies.onDocumentFetchError).to.have.been.calledWith(SERVICE_A_ID, SERVICE_A_TYPE);
        });

        it('emits no others events', async () => {
          expect(spies.onStartTrackingChanges).to.have.not.been.called;
          expect(spies.onEndTrackingChanges).to.have.not.been.called;
          expect(spies.onStartRefiltering).to.have.not.been.called;
          expect(spies.onEndRefiltering).to.have.not.been.called;
          expect(spies.onFirstSnapshotRecorded).to.have.not.been.called;
          expect(spies.onSnapshotRecorded).to.have.not.been.called;
          expect(spies.onNoSnapshotChanges).to.have.not.been.called;
          expect(spies.onFirstVersionRecorded).to.have.not.been.called;
          expect(spies.onVersionRecorded).to.have.not.been.called;
          expect(spies.onNoVersionChanges).to.have.not.been.called;
          expect(spies.onChangesPublished).to.have.not.been.called;
          expect(spies.onApplicationError).to.have.not.been.called;
          expect(spies.onRecordRefilterError).to.have.not.been.called;
          expect(spies.onDocumentUpdateError).to.have.not.been.called;
        });
      });
    });

    context('When tracking changes on new services', () => {
      before(async () => {
        nock('https://www.servicea.example').get('/tos').reply(200, SERVICE_A_TOS_SNAPSHOT);
        nock('https://www.serviceb.example').get('/tos').reply(200, SERVICE_B_TOS_SNAPSHOT);

        return app.trackChanges();
      });

      after(() => {
        resetSpiesHistory();
        return resetGitRepository();
      });

      it('emits a "startTrackingChanges" event', async () => {
        expect(spies.onStartTrackingChanges).to.have.been.calledOnce;
      });

      it('emits "onFirstSnapshotRecorded" events', async () => {
        expect(spies.onFirstSnapshotRecorded).to.have.been.calledTwice;
      });

      it('emits "onFirstVersionRecorded" events', async () => {
        expect(spies.onFirstVersionRecorded).to.have.been.calledTwice;
      });

      it('emits "onFirstVersionRecorded" events after "onFirstSnapshotRecorded" events', async () => {
        expect(spies.onFirstVersionRecorded).to.have.been.calledAfter(spies.onFirstSnapshotRecorded);
      });

      it('emits a "endTrackingChanges" event after "startTrackingChanges"', async () => {
        expect(spies.onEndTrackingChanges).to.have.been.calledAfter(spies.onStartTrackingChanges);
      });

      it('emits no other events', async () => {
        expect(spies.onStartRefiltering).to.have.not.been.called;
        expect(spies.onEndRefiltering).to.have.not.been.called;
        expect(spies.onSnapshotRecorded).to.have.not.been.called;
        expect(spies.onNoSnapshotChanges).to.have.not.been.called;
        expect(spies.onVersionRecorded).to.have.not.been.called;
        expect(spies.onNoVersionChanges).to.have.not.been.called;
        expect(spies.onChangesPublished).to.have.not.been.called;
        expect(spies.onApplicationError).to.have.not.been.called;
        expect(spies.onRecordRefilterError).to.have.not.been.called;
        expect(spies.onDocumentUpdateError).to.have.not.been.called;
        expect(spies.onDocumentFetchError).to.have.not.been.called;
      });
    });

    context('When tracking changes on already tracked services', () => {
      context('When services did not change', () => {
        before(async () => {
          nock('https://www.servicea.example').get('/tos').reply(200, SERVICE_A_TOS_SNAPSHOT);
          nock('https://www.serviceb.example').get('/tos').reply(200, SERVICE_B_TOS_SNAPSHOT);

          await app.trackChanges();

          nock('https://www.servicea.example').get('/tos').reply(200, SERVICE_A_TOS_SNAPSHOT);
          nock('https://www.serviceb.example').get('/tos').reply(200, SERVICE_B_TOS_SNAPSHOT);

          resetSpiesHistory();
          return app.trackChanges();
        });

        after(() => {
          resetSpiesHistory();
          return resetGitRepository();
        });

        it('emits a "startTrackingChanges" event', async () => {
          expect(spies.onStartTrackingChanges).to.have.been.calledOnce;
        });

        it('emits "onNoSnapshotChanges" events', async () => {
          expect(spies.onNoSnapshotChanges).to.have.been.calledTwice;
        });

        it('emits "onNoVersionChanges" events', async () => {
          expect(spies.onNoVersionChanges).to.have.been.calledTwice;
        });

        it('emits "onNoVersionChanges" events after "onSnapshotRecorded" events', async () => {
          expect(spies.onNoVersionChanges).to.have.been.calledAfter(spies.onNoSnapshotChanges);
        });

        it('emits a "endTrackingChanges" event after "startTrackingChanges"', async () => {
          expect(spies.onEndTrackingChanges).to.have.been.calledAfter(spies.onStartTrackingChanges);
        });

        it('emits no other events', async () => {
          expect(spies.onStartRefiltering).to.have.not.been.called;
          expect(spies.onEndRefiltering).to.have.not.been.called;
          expect(spies.onSnapshotRecorded).to.have.not.been.called;
          expect(spies.onFirstSnapshotRecorded).to.have.not.been.called;
          expect(spies.onVersionRecorded).to.have.not.been.called;
          expect(spies.onFirstVersionRecorded).to.have.not.been.called;
          expect(spies.onChangesPublished).to.have.not.been.called;
          expect(spies.onApplicationError).to.have.not.been.called;
          expect(spies.onRecordRefilterError).to.have.not.been.called;
          expect(spies.onDocumentUpdateError).to.have.not.been.called;
          expect(spies.onDocumentFetchError).to.have.not.been.called;
        });
      });

      context('When a service changed', () => {
        before(async () => {
          nock('https://www.servicea.example').get('/tos').reply(200, SERVICE_A_TOS_SNAPSHOT);
          nock('https://www.serviceb.example').get('/tos').reply(200, SERVICE_B_TOS_SNAPSHOT);

          await app.trackChanges();

          nock('https://www.servicea.example').get('/tos').reply(200, SERVICE_B_TOS_SNAPSHOT);
          nock('https://www.serviceb.example').get('/tos').reply(200, SERVICE_B_TOS_SNAPSHOT);

          resetSpiesHistory();
          return app.trackChanges();
        });

        after(() => {
          resetSpiesHistory();
          return resetGitRepository();
        });

        it('emits a "startTrackingChanges" event', async () => {
          expect(spies.onStartTrackingChanges).to.have.been.calledOnce;
        });

        it('emits "onNoSnapshotChanges" events', async () => {
          expect(spies.onNoSnapshotChanges).to.have.been.calledOnceWith(SERVICE_B_ID, SERVICE_B_TYPE);
        });

        it('emits "onSnapshotRecorded" event for service which changed', async () => {
          expect(spies.onSnapshotRecorded).to.have.been.calledOnceWith(SERVICE_A_ID, SERVICE_A_TYPE);
        });

        it('emits "onNoVersionChanges" events', async () => {
          expect(spies.onNoVersionChanges).to.have.been.calledOnceWith(SERVICE_B_ID, SERVICE_B_TYPE);
        });

        it('emits "onVersionRecorded" event for service which changed', async () => {
          expect(spies.onVersionRecorded).to.have.been.calledOnceWith(SERVICE_A_ID, SERVICE_A_TYPE);
        });

        it('emits "onSnapshotRecorded" events after "onVersionRecorded" events', async () => {
          expect(spies.onVersionRecorded).to.have.been.calledAfter(spies.onSnapshotRecorded);
        });

        it('emits a "endTrackingChanges" event after "startTrackingChanges"', async () => {
          expect(spies.onEndTrackingChanges).to.have.been.calledAfter(spies.onStartTrackingChanges);
        });

        it('emits no other events', async () => {
          expect(spies.onStartRefiltering).to.have.not.been.called;
          expect(spies.onEndRefiltering).to.have.not.been.called;
          expect(spies.onFirstSnapshotRecorded).to.have.not.been.called;
          expect(spies.onFirstVersionRecorded).to.have.not.been.called;
          expect(spies.onChangesPublished).to.have.not.been.called;
          expect(spies.onApplicationError).to.have.not.been.called;
          expect(spies.onRecordRefilterError).to.have.not.been.called;
          expect(spies.onDocumentUpdateError).to.have.not.been.called;
          expect(spies.onDocumentFetchError).to.have.not.been.called;
        });
      });
    });
  });
});
