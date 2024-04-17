import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import chai from 'chai';
import config from 'config';
import dircompare from 'dir-compare';
import mime from 'mime';
import StreamZip from 'node-stream-zip';

import GitRepository from '../../../src/archivist/recorder/repositories/git/index.js';
import Version from '../../../src/archivist/recorder/version.js';

import generateArchive from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { expect } = chai;

const FIRST_SERVICE_PROVIDER_ID = 'ServiceA';
const SECOND_SERVICE_PROVIDER_ID = 'ServiceB';

const FIRST_TERMS_TYPE = 'Terms of Service';
const SECOND_TERMS_TYPE = 'Privacy Policy';

const FIRST_FETCH_DATE = '2021-01-01T11:27:00.000Z';
const SECOND_FETCH_DATE = '2021-01-11T11:32:47.000Z';
const THIRD_FETCH_DATE = '2022-01-06T11:32:47.000Z';
const FOURTH_FETCH_DATE = '2022-01-01T12:12:24.000Z';

const FIRST_CONTENT = 'First Content';
const SECOND_CONTENT = 'Second Content';

const SNAPSHOT_ID = '721ce4a63ad399ecbdb548a66d6d327e7bc97876';

const RELEASE_DATE = '2022-01-01T18:21:00.000Z';

describe('Export', () => {
  describe('#generateArchive', () => {
    const ARCHIVE_NAME = 'test-dataset';
    const ARCHIVE_PATH = path.resolve(__dirname, `./tmp/${ARCHIVE_NAME}.zip`);
    const TMP_PATH = path.resolve(__dirname, './tmp');
    const EXPECTED_DATASET_PATH = path.resolve(__dirname, './test/fixtures/dataset');

    let repository;
    let zip;

    before(async function () {
      this.timeout(10000);
      repository = new GitRepository({
        ...config.get('@opentermsarchive/engine.recorder.versions.storage.git'),
        path: path.resolve(__dirname, '../../../', config.get('@opentermsarchive/engine.recorder.versions.storage.git.path')),
      });

      await repository.initialize();

      await repository.save(new Version({
        serviceId: FIRST_SERVICE_PROVIDER_ID,
        termsType: FIRST_TERMS_TYPE,
        content: FIRST_CONTENT,
        fetchDate: FIRST_FETCH_DATE,
        snapshotId: SNAPSHOT_ID,
      }));

      await repository.save(new Version({
        serviceId: FIRST_SERVICE_PROVIDER_ID,
        termsType: FIRST_TERMS_TYPE,
        content: SECOND_CONTENT,
        fetchDate: SECOND_FETCH_DATE,
        snapshotId: SNAPSHOT_ID,
      }));

      await repository.save(new Version({
        serviceId: SECOND_SERVICE_PROVIDER_ID,
        termsType: FIRST_TERMS_TYPE,
        content: FIRST_CONTENT,
        fetchDate: THIRD_FETCH_DATE,
        snapshotId: SNAPSHOT_ID,
      }));

      await repository.save(new Version({
        serviceId: SECOND_SERVICE_PROVIDER_ID,
        termsType: SECOND_TERMS_TYPE,
        content: FIRST_CONTENT,
        fetchDate: FOURTH_FETCH_DATE,
        snapshotId: SNAPSHOT_ID,
      }));

      await generateArchive({
        archivePath: ARCHIVE_PATH,
        releaseDate: new Date(RELEASE_DATE),
      });

      zip = new StreamZip.async({ file: ARCHIVE_PATH });
      await zip.extract('', TMP_PATH);
      await zip.close();
    });

    after(async () => {
      await fs.rm(TMP_PATH, { recursive: true });
      await repository.removeAll();
    });

    it('is an archive', () => {
      const mimeType = mime.getType(ARCHIVE_PATH);

      expect(mimeType).to.equal('application/zip');
    });

    it('has the proper contents', () => {
      expect(`${TMP_PATH}/${ARCHIVE_NAME}`).to.have.sameContentAs(EXPECTED_DATASET_PATH);
    });
  });
});

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

     There are ${result.differences} differences:\n`;

      result.diffSet.forEach(diff => {
        if (diff.state == 'equal') {
          return;
        }

        message += `     ${diff.reason} on file ${diff.name1} | ${diff.name2}\n`;
      });

      return message;
    }
  });
});
