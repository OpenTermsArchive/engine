import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import chai from 'chai';
import config from 'config';
import dircompare from 'dir-compare';
import mime from 'mime';
import StreamZip from 'node-stream-zip';

import GitAdapter from '../../../src/storage-adapters/git/index.js';

import generateArchive from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { expect } = chai;

const FIRST_SERVICE_PROVIDER_ID = 'ServiceA';
const SECOND_SERVICE_PROVIDER_ID = 'ServiceB';

const FIRST_DOCUMENT_TYPE = 'Terms of Service';
const SECOND_DOCUMENT_TYPE = 'Privacy Policy';

const FIRST_FETCH_DATE = '2021-01-01T11:27:00.000Z';
const SECOND_FETCH_DATE = '2021-01-11T11:32:47.000Z';
const THIRD_FETCH_DATE = '2022-01-06T11:32:47.000Z';
const FOURTH_FETCH_DATE = '2022-01-01T12:12:24.000Z';

const FIRST_CONTENT = 'First Content';
const SECOND_CONTENT = 'Second Content';

const SNAPSHOT_ID = '721ce4a63ad399ecbdb548a66d6d327e7bc97876';

const RELEASE_DATE = '2022-01-01T18:21:00.000Z';

chai.use(chai => {
  const { Assertion } = chai;

  Assertion.addMethod('sameContentAs', function (expectedContentPath) {
    const givenContentPath = this._obj;

    const result = dircompare.compareSync(givenContentPath, expectedContentPath, {
      excludeFilter: '.DS_Store',
      compareContent: true,
    });

    this.assert(
      result.same,
      generateFailureMessage(result),
      `expected ${givenContentPath} to have a different content as ${expectedContentPath}`,
    );

    function generateFailureMessage(result) {
      let message = `expected ${givenContentPath} to have the same content as ${expectedContentPath}

     Statistics - equal entries: ${result.equal}, distinct entries: ${result.distinct}, left only entries: ${result.left}, right only entries: ${result.right}, differences: ${result.differences}\n`;

      result.diffSet.forEach(diff => {
        if (diff.state == 'equal') {
          return;
        }

        message += `     Reason: ${diff.reason}: File - name1: ${diff.name1}, type1: ${diff.type1}, name2: ${diff.name2}, type2: ${diff.type2}\n`;
      });

      return message;
    }
  });
});

describe('Export', () => {
  describe('#generateArchive', () => {
    let storageAdapter;
    const archiveName = 'test-dataset';
    const archivePath = path.resolve(__dirname, `./tmp/${archiveName}.zip`);
    const tmpPath = path.resolve(__dirname, './tmp');
    const datasetFixturesPath = path.resolve(__dirname, './test/fixtures/dataset');
    let zip;

    before(async function () {
      this.timeout(10000);
      storageAdapter = new GitAdapter({
        ...config.get('recorder.versions.storage.git'),
        path: path.resolve(__dirname, '../../../', config.get('recorder.versions.storage.git.path')),
        fileExtension: 'md',
      });

      await storageAdapter.initialize();

      await storageAdapter.record({
        serviceId: FIRST_SERVICE_PROVIDER_ID,
        documentType: FIRST_DOCUMENT_TYPE,
        content: FIRST_CONTENT,
        fetchDate: FIRST_FETCH_DATE,
        snapshotId: SNAPSHOT_ID,
      });

      await storageAdapter.record({
        serviceId: FIRST_SERVICE_PROVIDER_ID,
        documentType: FIRST_DOCUMENT_TYPE,
        content: SECOND_CONTENT,
        fetchDate: SECOND_FETCH_DATE,
        snapshotId: SNAPSHOT_ID,
      });

      await storageAdapter.record({
        serviceId: SECOND_SERVICE_PROVIDER_ID,
        documentType: FIRST_DOCUMENT_TYPE,
        content: FIRST_CONTENT,
        fetchDate: THIRD_FETCH_DATE,
        snapshotId: SNAPSHOT_ID,
      });

      await storageAdapter.record({
        serviceId: SECOND_SERVICE_PROVIDER_ID,
        documentType: SECOND_DOCUMENT_TYPE,
        content: FIRST_CONTENT,
        fetchDate: FOURTH_FETCH_DATE,
        snapshotId: SNAPSHOT_ID,
      });

      await generateArchive({
        archivePath,
        releaseDate: new Date(RELEASE_DATE),
      });

      zip = new StreamZip.async({ file: archivePath }); // eslint-disable-line new-cap
      await zip.extract('', tmpPath);
      await zip.close();
    });

    after(async () => {
      await fs.rm(tmpPath, { recursive: true });
      await storageAdapter._removeAllRecords();
    });

    it('is an archive', () => {
      const mimeType = mime.getType(archivePath);

      expect(mimeType).to.be.equal('application/zip');
    });

    it('has the proper contents', () => {
      expect(`${tmpPath}/${archiveName}`).to.have.sameContentAs(datasetFixturesPath);
    });
  });
});
