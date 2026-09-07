import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import sinon from 'sinon';

import RepositoryFactory from '../../src/archivist/recorder/repositories/factory.js';
import Version from '../../src/archivist/recorder/version.js';
import DatasetStorage, { TEMPORARY_SUFFIX } from '../../src/dataset/storage.js';

import { release } from './index.js';

use(chaiAsPromised);

const FIRST_SERVICE_PROVIDER_ID = 'ServiceA';
const SECOND_SERVICE_PROVIDER_ID = 'ServiceB';

const FIRST_TERMS_TYPE = 'Terms of Service';
const SECOND_TERMS_TYPE = 'Privacy Policy';

const FIRST_FETCH_DATE = '2021-01-01T11:27:00.000Z';
const SECOND_FETCH_DATE = '2021-01-11T11:32:47.000Z';
const THIRD_FETCH_DATE = '2022-01-06T11:32:47.000Z';
const FOURTH_FETCH_DATE = '2022-01-01T12:12:24.000Z';

const SNAPSHOT_ID = '721ce4a63ad399ecbdb548a66d6d327e7bc97876';

const STALE_ARCHIVE_FILENAME = 'stale.zip';

describe('Dataset release', () => {
  describe('#release', () => {
    const storage = new DatasetStorage(config.get('@opentermsarchive/engine.dataset.storagePath')); // Instantiated up front, so a `before` hook failing partway through still leaves `after` a valid `storage` to clean up

    let repository;
    let metadata;

    before(async function () {
      this.timeout(10000);
      repository = RepositoryFactory.create(config.get('@opentermsarchive/engine.recorder.versions.storage'));
      await repository.initialize();
      await repository.removeAll();

      const versions = [
        [ FIRST_SERVICE_PROVIDER_ID, FIRST_TERMS_TYPE, FIRST_FETCH_DATE ],
        [ FIRST_SERVICE_PROVIDER_ID, FIRST_TERMS_TYPE, SECOND_FETCH_DATE ],
        [ SECOND_SERVICE_PROVIDER_ID, FIRST_TERMS_TYPE, THIRD_FETCH_DATE ],
        [ SECOND_SERVICE_PROVIDER_ID, SECOND_TERMS_TYPE, FOURTH_FETCH_DATE ],
      ];

      for (const [ serviceId, termsType, fetchDate ] of versions) {
        await repository.save(new Version({
          serviceId,
          termsType,
          content: `Content of ${serviceId} ${termsType} fetched on ${fetchDate}`,
          fetchDate,
          snapshotId: SNAPSHOT_ID,
        }));
      }

      await fs.mkdir(storage.path, { recursive: true });
      await fs.writeFile(storage.archivePath(STALE_ARCHIVE_FILENAME), 'stale archive');

      await release({});

      metadata = await storage.findLatest();
    });

    after(async () => {
      await repository.removeAll();
      await fs.rm(storage.path, { recursive: true, force: true });
    });

    it('names the archive after the dataset title and the release date', () => {
      expect(metadata.filename).to.match(/^sandbox-\d{4}-\d{2}-\d{2}\.zip$/);
    });

    it('stores the archive in the storage directory', async () => {
      await expect(fs.access(storage.archivePath(metadata.filename))).to.be.fulfilled;
    });

    it('writes no archive in the current working directory', async () => {
      await expect(fs.access(path.resolve(process.cwd(), metadata.filename))).to.be.rejected;
    });

    it('removes previous archives', async () => {
      await expect(fs.access(storage.archivePath(STALE_ARCHIVE_FILENAME))).to.be.rejected;
    });

    it('leaves no temporary file', async () => {
      const entries = await fs.readdir(storage.path);

      expect(entries.filter(entry => entry.endsWith(TEMPORARY_SUFFIX))).to.be.empty;
    });

    describe('metadata', () => {
      it('describe the dataset title', () => {
        expect(metadata.title).to.equal('sandbox');
      });

      it('describe the license as an SPDX identifier', () => {
        expect(metadata.license).to.equal('ODbL-1.0');
      });

      it('describe the release date as an ISO 8601 date without milliseconds', () => {
        expect(metadata.releaseDate).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      });

      it('describe the first version date', () => {
        expect(metadata.firstVersionDate).to.equal('2021-01-01T11:27:00Z');
      });

      it('describe the last version date', () => {
        expect(metadata.lastVersionDate).to.equal('2022-01-06T11:32:47Z');
      });

      it('count the services', () => {
        expect(metadata.servicesCount).to.equal(2);
      });

      it('count the distinct terms', () => {
        expect(metadata.termsCount).to.equal(3);
      });

      it('count the versions', () => {
        expect(metadata.versionsCount).to.equal(4);
      });

      it('describe the archive size in bytes', async () => {
        expect(metadata.size).to.equal((await fs.stat(storage.archivePath(metadata.filename))).size);
      });

      it('describe the archive SHA-256 checksum', async () => {
        expect(metadata.sha256).to.equal(createHash('sha256').update(await fs.readFile(storage.archivePath(metadata.filename))).digest('hex'));
      });
    });

    context('when removing previous archives fails', () => {
      let error;

      before(async function () {
        this.timeout(10000);

        const staleArchivePath = storage.archivePath(metadata.filename); // the archive from the outer release(), now standing in the way of this second one
        const originalRm = fs.rm.bind(fs);

        sinon.stub(fs, 'rm').callsFake((path, options) => (path === staleArchivePath ? Promise.reject(new Error('Permission denied')) : originalRm(path, options)));

        try {
          await release({ fileName: 'second-release' });
        } catch (releaseError) {
          error = releaseError;
        }
      });

      after(() => {
        sinon.restore();
      });

      it('resolves despite the cleanup failure', () => {
        expect(error).to.be.undefined;
      });
    });

    context('when a custom file name is given without extension', () => {
      let customMetadata;

      before(async function () {
        this.timeout(10000);
        await release({ fileName: 'custom' });
        customMetadata = await storage.findLatest();
      });

      it('names the archive after the given file name', () => {
        expect(customMetadata.filename).to.equal('custom.zip');
      });
    });

    context('when a custom file name is given with a .zip extension', () => {
      let customMetadata;

      before(async function () {
        this.timeout(10000);
        await release({ fileName: 'custom.zip' });
        customMetadata = await storage.findLatest();
      });

      it('names the archive after the given file name', () => {
        expect(customMetadata.filename).to.equal('custom.zip');
      });
    });
  });
});
