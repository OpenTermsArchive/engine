import chai from 'chai';
import fsApi from 'fs';
import path from 'path';
import nock from 'nock';

import CGUs from './index.js';
import { SNAPSHOTS_PATH, VERSIONS_PATH } from './history/index.js';
import { resetGitRepository, gitVersion, gitSnapshot } from '../test/helper.js';

const fs = fsApi.promises;
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const { expect } = chai;

const SERVICE_A_ID = 'service_A';
const SERVICE_A_TYPE = 'Terms of Service';
const SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH = `${SNAPSHOTS_PATH}/${SERVICE_A_ID}/${SERVICE_A_TYPE}.html`;
const SERVICE_A_EXPECTED_VERSION_FILE_PATH = `${VERSIONS_PATH}/${SERVICE_A_ID}/${SERVICE_A_TYPE}.md`;
const SERVICE_A_TOS_SNAPSHOT = fsApi.readFileSync(path.resolve(__dirname, '../test/fixtures/service_A_terms_snapshot.html'), { encoding: 'utf8' });
const SERVICE_A_TOS_VERSION = fsApi.readFileSync(path.resolve(__dirname, '../test/fixtures/service_A_terms.md'), { encoding: 'utf8' });

const SERVICE_B_ID = 'service_B';
const SERVICE_B_TYPE = 'Terms of Service';
const SERVICE_B_EXPECTED_SNAPSHOT_FILE_PATH = `${SNAPSHOTS_PATH}/${SERVICE_B_ID}/${SERVICE_B_TYPE}.html`;
const SERVICE_B_EXPECTED_VERSION_FILE_PATH = `${VERSIONS_PATH}/${SERVICE_B_ID}/${SERVICE_B_TYPE}.md`;
const SERVICE_B_TOS_SNAPSHOT = fsApi.readFileSync(path.resolve(__dirname, '../test/fixtures/service_B_terms_snapshot.html'), { encoding: 'utf8' });
const SERVICE_B_TOS_VERSION = fsApi.readFileSync(path.resolve(__dirname, '../test/fixtures/service_B_terms.md'), { encoding: 'utf8' });

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
      let serviceBVersionId;

      before(async () => {
        nock('https://www.servicea.example').get('/tos').reply(200, SERVICE_A_TOS_SNAPSHOT);
        nock('https://www.serviceb.example').get('/tos').reply(200, SERVICE_B_TOS_SNAPSHOT);
        const app = new CGUs();
        await app.init();
        await app.trackChanges();

        const [originalSnapshotCommit] = await gitSnapshot().log({ file: SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH });
        originalSnapshotId = originalSnapshotCommit.hash;

        const [firstVersionCommit] = await gitVersion().log({ file: SERVICE_A_EXPECTED_VERSION_FILE_PATH });
        firstVersionId = firstVersionCommit.hash;

        const [serviceBVersionCommit] = await gitVersion().log({ file: SERVICE_B_EXPECTED_VERSION_FILE_PATH });
        serviceBVersionId = serviceBVersionCommit.hash;

        app._serviceDeclarations[SERVICE_A_ID].documents[SERVICE_A_TYPE].select = 'h1';

        await app.refilterAndRecord();

        const [refilterVersionCommit] = await gitVersion().log({ file: SERVICE_A_EXPECTED_VERSION_FILE_PATH });
        refilterVersionId = refilterVersionCommit.hash;
        refilterVersionMessageBody = refilterVersionCommit.body;
      });

      after(resetGitRepository);

      it('refilters the content and saves the file', async () => {
        const serviceAContent = await fs.readFile(path.resolve(__dirname, SERVICE_A_EXPECTED_VERSION_FILE_PATH), { encoding: 'utf8' })
        expect(serviceAContent).to.be.equal('Terms of service\n================');
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
        const [serviceBCommit] = await gitVersion().log({ file: SERVICE_B_EXPECTED_VERSION_FILE_PATH });
        expect(serviceBCommit.hash).to.be.equal(serviceBVersionId);
      });
    });
  });
});
