import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';

import DatasetStorage, { TEMPORARY_SUFFIX } from './storage.js';

use(chaiAsPromised);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TMP_PATH = path.resolve(__dirname, './tmp');
const ARCHIVE_FILENAME = 'dataset-2026-01-01.zip';
const PREVIOUS_ARCHIVE_FILENAME = 'dataset-2025-12-25.zip';
const INTERRUPTED_ARCHIVE_FILENAME = `dataset-2025-12-26.zip${TEMPORARY_SUFFIX}`;
const UNRELATED_FILENAME = 'notes.txt';
const METADATA = {
  filename: ARCHIVE_FILENAME,
  title: 'sandbox',
  license: 'ODbL-1.0',
  releaseDate: '2026-01-01T08:30:00Z',
  firstVersionDate: '2021-01-01T11:27:00Z',
  lastVersionDate: '2022-01-06T11:32:47Z',
  servicesCount: 2,
  termsCount: 3,
  versionsCount: 4,
  size: 15,
  sha256: 'a'.repeat(64),
};

describe('DatasetStorage', () => {
  let storage;

  beforeEach(async () => {
    await fs.rm(TMP_PATH, { recursive: true, force: true });
    storage = new DatasetStorage(TMP_PATH);
  });

  after(async () => {
    await fs.rm(TMP_PATH, { recursive: true, force: true });
  });

  describe('#findLatest', () => {
    context('when the storage directory does not exist', () => {
      it('returns null', async () => {
        expect(await storage.findLatest()).to.be.null;
      });
    });

    context('when no metadata file exists', () => {
      beforeEach(async () => {
        await fs.mkdir(TMP_PATH, { recursive: true });
      });

      it('returns null', async () => {
        expect(await storage.findLatest()).to.be.null;
      });
    });

    context('when the metadata file references a missing archive', () => {
      beforeEach(async () => {
        await fs.mkdir(TMP_PATH, { recursive: true });
        await fs.writeFile(storage.metadataPath, JSON.stringify(METADATA));
      });

      it('returns null', async () => {
        expect(await storage.findLatest()).to.be.null;
      });
    });

    context('when the metadata file is corrupted', () => {
      beforeEach(async () => {
        await fs.mkdir(TMP_PATH, { recursive: true });
        await fs.writeFile(storage.metadataPath, '{ not json');
      });

      it('rejects', async () => {
        await expect(storage.findLatest()).to.be.rejected;
      });
    });

    context('when the metadata file and the archive exist', () => {
      beforeEach(async () => {
        await fs.mkdir(TMP_PATH, { recursive: true });
        await fs.writeFile(storage.archivePath(ARCHIVE_FILENAME), 'archive content');
        await fs.writeFile(storage.metadataPath, JSON.stringify(METADATA));
      });

      it('returns the metadata', async () => {
        expect(await storage.findLatest()).to.deep.equal(METADATA);
      });
    });
  });

  describe('#save', () => {
    context('when the archive is missing', () => {
      beforeEach(async () => {
        await fs.mkdir(TMP_PATH, { recursive: true });
      });

      it('rejects', async () => {
        await expect(storage.save(METADATA)).to.be.rejected;
      });

      it('writes no metadata file', async () => {
        await storage.save(METADATA).catch(() => {});

        await expect(fs.access(storage.metadataPath)).to.be.rejected;
      });
    });

    context('when the archive exists', () => {
      beforeEach(async () => {
        await fs.mkdir(TMP_PATH, { recursive: true });
        await fs.writeFile(storage.archivePath(ARCHIVE_FILENAME), 'archive content');
        await storage.save(METADATA);
      });

      it('writes the metadata file', async () => {
        expect(JSON.parse(await fs.readFile(storage.metadataPath, 'utf8'))).to.deep.equal(METADATA);
      });

      it('leaves no temporary metadata file', async () => {
        await expect(fs.access(`${storage.metadataPath}${TEMPORARY_SUFFIX}`)).to.be.rejected;
      });

      it('keeps the archive', async () => {
        await expect(fs.access(storage.archivePath(ARCHIVE_FILENAME))).to.be.fulfilled;
      });
    });
  });

  describe('#removePreviousArchives', () => {
    context('when no metadata exists', () => {
      beforeEach(async () => {
        await fs.mkdir(TMP_PATH, { recursive: true });
      });

      it('does nothing', async () => {
        await expect(storage.removePreviousArchives()).to.be.fulfilled;
      });
    });

    context('when metadata exists', () => {
      beforeEach(async () => {
        await fs.mkdir(TMP_PATH, { recursive: true });
        await fs.writeFile(storage.archivePath(ARCHIVE_FILENAME), 'archive content');
        await fs.writeFile(storage.archivePath(PREVIOUS_ARCHIVE_FILENAME), 'previous archive');
        await fs.writeFile(storage.archivePath(INTERRUPTED_ARCHIVE_FILENAME), 'interrupted archive');
        await fs.writeFile(storage.archivePath(UNRELATED_FILENAME), 'unrelated content');
        await fs.writeFile(storage.metadataPath, JSON.stringify(METADATA));

        await storage.removePreviousArchives();
      });

      it('keeps the current archive', async () => {
        await expect(fs.access(storage.archivePath(ARCHIVE_FILENAME))).to.be.fulfilled;
      });

      it('removes previous archives', async () => {
        await expect(fs.access(storage.archivePath(PREVIOUS_ARCHIVE_FILENAME))).to.be.rejected;
      });

      it('removes interrupted archives', async () => {
        await expect(fs.access(storage.archivePath(INTERRUPTED_ARCHIVE_FILENAME))).to.be.rejected;
      });

      it('keeps unrelated files', async () => {
        await expect(fs.access(storage.archivePath(UNRELATED_FILENAME))).to.be.fulfilled;
      });
    });

    context('when a previous archive fails to be removed', () => {
      beforeEach(async () => {
        await fs.mkdir(TMP_PATH, { recursive: true });
        await fs.writeFile(storage.archivePath(ARCHIVE_FILENAME), 'archive content');
        await fs.writeFile(storage.archivePath(PREVIOUS_ARCHIVE_FILENAME), 'previous archive');
        await fs.writeFile(storage.metadataPath, JSON.stringify(METADATA));

        sinon.stub(fs, 'rm').rejects(new Error('Permission denied'));
      });

      after(() => {
        sinon.restore();
      });

      it('rejects', async () => {
        await expect(storage.removePreviousArchives()).to.be.rejected;
      });
    });
  });
});
