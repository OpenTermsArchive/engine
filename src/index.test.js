import fsApi from 'fs';
import path from 'path';

import chai from 'chai';
import nock from 'nock';

import CGUs from './index.js';
import { SNAPSHOTS_PATH, VERSIONS_PATH } from './history/index.js';
import { resetGitRepository, gitVersion, gitSnapshot } from '../test/helper.js';

const fs = fsApi.promises;
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const { expect } = chai;

describe('CGUs', () => {
  const SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH = `${SNAPSHOTS_PATH}/service_A/Terms of Service.html`;
  const SERVICE_A_EXPECTED_VERSION_FILE_PATH = `${VERSIONS_PATH}/service_A/Terms of Service.md`;
  let serviceASnapshotExpectedContent;
  let serviceAVersionExpectedContent;

  const SERVICE_B_EXPECTED_SNAPSHOT_FILE_PATH = `${SNAPSHOTS_PATH}/service_B/Terms of Service.pdf`;
  const SERVICE_B_EXPECTED_VERSION_FILE_PATH = `${VERSIONS_PATH}/service_B/Terms of Service.md`;
  let serviceBSnapshotExpectedContent;
  let serviceBVersionExpectedContent;

  before(async () => {
    serviceASnapshotExpectedContent = await fs.readFile(path.resolve(__dirname, '../test/fixtures/service_A_terms_snapshot.html'), { encoding: 'utf8' });
    serviceAVersionExpectedContent = await fs.readFile(path.resolve(__dirname, '../test/fixtures/service_A_terms.md'), { encoding: 'utf8' });
    serviceBSnapshotExpectedContent = await fs.readFile(path.resolve(__dirname, '../test/fixtures/terms.pdf'));
    serviceBVersionExpectedContent = await fs.readFile(path.resolve(__dirname, '../test/fixtures/termsFromPDF.md'), { encoding: 'utf8' });

    nock('https://www.servicea.example').persist().get('/tos').reply(200, serviceASnapshotExpectedContent, { 'Content-Type': 'text/html' });
    nock('https://www.serviceb.example').persist().get('/tos').reply(200, serviceBSnapshotExpectedContent, { 'Content-Type': 'application/pdf' });
  });

  describe('#trackChanges', () => {
    before(async () => {
      const app = new CGUs();
      await app.init();
      return app.trackChanges();
    });

    after(resetGitRepository);

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

  describe('#refilterAndRecord', () => {
    context('When a service’s filter declaration changes', () => {
      let originalSnapshotId;
      let firstVersionId;
      let refilterVersionId;
      let refilterVersionMessageBody;
      let serviceBCommits;

      before(async () => {
        const app = new CGUs();
        await app.init();
        await app.trackChanges();

        const [ originalSnapshotCommit ] = await gitSnapshot().log({ file: SERVICE_A_EXPECTED_SNAPSHOT_FILE_PATH });
        originalSnapshotId = originalSnapshotCommit.hash;

        const [ firstVersionCommit ] = await gitVersion().log({ file: SERVICE_A_EXPECTED_VERSION_FILE_PATH });
        firstVersionId = firstVersionCommit.hash;

        serviceBCommits = await gitVersion().log({ file: SERVICE_B_EXPECTED_VERSION_FILE_PATH });

        app._serviceDeclarations.service_A.documents['Terms of Service'].select = 'h1';

        await app.refilterAndRecord();

        const [ refilterVersionCommit ] = await gitVersion().log({ file: SERVICE_A_EXPECTED_VERSION_FILE_PATH });
        refilterVersionId = refilterVersionCommit.hash;
        refilterVersionMessageBody = refilterVersionCommit.body;
      });

      after(resetGitRepository);

      it('refilters the content and saves the file', async () => {
        const serviceAContent = await fs.readFile(path.resolve(__dirname, SERVICE_A_EXPECTED_VERSION_FILE_PATH), { encoding: 'utf8' });
        expect(serviceAContent).to.equal('Terms of service with UTF-8 \'çhãràčtęrs"\n========================================');
      });

      it('generates a new version id', async () => {
        expect(refilterVersionId).to.not.equal(firstVersionId);
      });

      it('mentions the snapshot id in the changelog', async () => {
        expect(refilterVersionMessageBody).to.include(originalSnapshotId);
      });

      it('does not change other services', async () => {
        const serviceBVersion = await fs.readFile(path.resolve(__dirname, SERVICE_B_EXPECTED_VERSION_FILE_PATH), { encoding: 'utf8' });
        expect(serviceBVersion).to.equal(serviceBVersionExpectedContent);
      });

      it('does not generate a new id for other services', async () => {
        const serviceBCommitsAfterRefiltering = await gitVersion().log({ file: SERVICE_B_EXPECTED_VERSION_FILE_PATH });
        expect(serviceBCommitsAfterRefiltering.map(commit => commit.hash)).to.deep.equal(serviceBCommits.map(commit => commit.hash));
      });
    });
  });
});
