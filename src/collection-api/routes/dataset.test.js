import { createHash } from 'crypto';
import fs from 'fs/promises';

import { expect } from 'chai';
import config from 'config';
import supertest from 'supertest';

import DatasetStorage from '../../dataset/storage.js';
import app from '../server.js';

const basePath = config.get('@opentermsarchive/engine.collection-api.basePath');
const request = supertest(app);

function binaryParser(res, callback) { // superagent only buffers text, JSON and media types on its own, so ZIP bodies have to be collected explicitly
  const chunks = [];

  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

const METADATA_URL = `${basePath}/v1/dataset/latest`;
const DOWNLOAD_URL = `${basePath}/v1/dataset/latest/download`;
const NO_DATASET_ERROR = 'No dataset has been generated yet';
const ARCHIVE_FILENAME = 'sandbox-2026-01-01.zip';
const ARCHIVE_CONTENT = Buffer.from('Archive content standing for a ZIP file in tests');
const METADATA = {
  filename: ARCHIVE_FILENAME,
  title: 'sandbox',
  license: 'ODbL-1.0',
  releaseDate: '2026-01-01T08:30:12Z',
  firstVersionDate: '2021-01-01T11:27:00Z',
  lastVersionDate: '2022-01-06T11:32:47Z',
  servicesCount: 2,
  termsCount: 3,
  versionsCount: 4,
  size: ARCHIVE_CONTENT.length,
  sha256: createHash('sha256').update(ARCHIVE_CONTENT).digest('hex'),
};

describe('Dataset API', () => {
  const storage = new DatasetStorage(config.get('@opentermsarchive/engine.dataset.storagePath'));

  async function storeDataset() {
    await fs.mkdir(storage.path, { recursive: true });
    await fs.writeFile(storage.archivePath(ARCHIVE_FILENAME), ARCHIVE_CONTENT);
    await storage.save(METADATA);
  }

  async function removeDataset() {
    await fs.rm(storage.path, { recursive: true, force: true });
  }

  function itRespondsWithNoDatasetError(getResponse) {
    it('responds with 404 status code', () => {
      expect(getResponse().status).to.equal(404);
    });

    it('responds with Content-Type application/json', () => {
      expect(getResponse().type).to.equal('application/json');
    });

    it('returns an explicit error message', () => {
      expect(getResponse().body).to.deep.equal({ error: NO_DATASET_ERROR });
    });
  }

  describe('GET /dataset/latest', () => {
    let response;

    context('when no dataset has been generated', () => {
      before(async () => {
        await removeDataset();
        response = await request.get(METADATA_URL);
      });

      itRespondsWithNoDatasetError(() => response);
    });

    context('when the archive described by the metadata is missing', () => {
      before(async () => {
        await storeDataset();
        await fs.rm(storage.archivePath(ARCHIVE_FILENAME));
        response = await request.get(METADATA_URL);
      });

      after(removeDataset);

      itRespondsWithNoDatasetError(() => response);
    });

    context('when a dataset exists', () => {
      before(async () => {
        await storeDataset();
        response = await request.get(METADATA_URL);
      });

      after(removeDataset);

      it('responds with 200 status code', () => {
        expect(response.status).to.equal(200);
      });

      it('responds with Content-Type application/json', () => {
        expect(response.type).to.equal('application/json');
      });

      it('returns the dataset metadata along with its download URL', () => {
        const { host } = new URL(response.request.url);

        expect(response.body).to.deep.equal({
          ...METADATA,
          downloadURL: `http://${host}${DOWNLOAD_URL}`,
        });
      });
    });

    context('behind a reverse proxy', () => {
      before(async () => {
        await storeDataset();
        response = await request
          .get(METADATA_URL)
          .set('X-Forwarded-Proto', 'https')
          .set('X-Forwarded-Host', 'api.example.com');
      });

      after(removeDataset);

      it('uses the forwarded protocol and host in the download URL', () => {
        expect(response.body.downloadURL).to.equal(`https://api.example.com${DOWNLOAD_URL}`);
      });
    });

    context('behind a chain of reverse proxies', () => {
      before(async () => {
        await storeDataset();
        response = await request
          .get(METADATA_URL)
          .set('X-Forwarded-Proto', 'https')
          .set('X-Forwarded-Host', 'api.example.com, edge.internal');
      });

      after(removeDataset);

      it('uses the first host in the forwarded list in the download URL', () => {
        expect(response.body.downloadURL).to.equal(`https://api.example.com${DOWNLOAD_URL}`);
      });
    });

    context('when the stored metadata is corrupted', () => {
      before(async () => {
        await fs.mkdir(storage.path, { recursive: true });
        await fs.writeFile(storage.metadataPath, '{ not json');
        response = await request.get(METADATA_URL);
      });

      after(removeDataset);

      it('responds with 500 status code', () => {
        expect(response.status).to.equal(500);
      });

      it('responds with Content-Type application/json', () => {
        expect(response.type).to.equal('application/json');
      });

      it('returns a generic error message', () => {
        expect(response.body).to.deep.equal({ error: 'Internal Server Error' });
      });
    });
  });

  describe('GET /dataset/latest/download', () => {
    let response;

    context('when no dataset has been generated', () => {
      before(async () => {
        await removeDataset();
        response = await request.get(DOWNLOAD_URL);
      });

      itRespondsWithNoDatasetError(() => response);
    });

    context('when the archive described by the metadata is missing', () => {
      before(async () => {
        await storeDataset();
        await fs.rm(storage.archivePath(ARCHIVE_FILENAME));
        response = await request.get(DOWNLOAD_URL);
      });

      after(removeDataset);

      itRespondsWithNoDatasetError(() => response);
    });

    context('when a dataset exists', () => {
      before(storeDataset);

      after(removeDataset);

      describe('without conditions', () => {
        before(async () => {
          response = await request.get(DOWNLOAD_URL).buffer(true).parse(binaryParser);
        });

        it('responds with 200 status code', () => {
          expect(response.status).to.equal(200);
        });

        it('responds with Content-Type application/zip', () => {
          expect(response.type).to.equal('application/zip');
        });

        it('exposes the archive as an attachment named after the archive file', () => {
          expect(response.headers['content-disposition']).to.equal(`attachment; filename="${ARCHIVE_FILENAME}"`);
        });

        it('exposes the archive size as Content-Length', () => {
          expect(response.headers['content-length']).to.equal(String(ARCHIVE_CONTENT.length));
        });

        it('exposes the archive checksum as a strong ETag', () => {
          expect(response.headers.etag).to.equal(`"${METADATA.sha256}"`);
        });

        it('exposes the release date as Last-Modified', () => {
          expect(response.headers['last-modified']).to.equal(new Date(METADATA.releaseDate).toUTCString());
        });

        it('advertises byte range support', () => {
          expect(response.headers['accept-ranges']).to.equal('bytes');
        });

        it('returns the archive content', () => {
          expect(response.body.equals(ARCHIVE_CONTENT)).to.be.true;
        });
      });

      describe('with a conditional request', () => {
        it('returns 304 with no body when If-None-Match matches the archive checksum', async () => {
          const conditionalResponse = await request.get(DOWNLOAD_URL).set('If-None-Match', `"${METADATA.sha256}"`);

          expect(conditionalResponse.status).to.equal(304);
          expect(conditionalResponse.text).to.be.empty;
        });

        it('returns 200 with the archive when If-None-Match does not match', async () => {
          const conditionalResponse = await request.get(DOWNLOAD_URL).set('If-None-Match', '"another-checksum"');

          expect(conditionalResponse.status).to.equal(200);
        });

        it('returns 304 with no body when If-Modified-Since is at or after the release date', async () => {
          const conditionalResponse = await request.get(DOWNLOAD_URL).set('If-Modified-Since', new Date(METADATA.releaseDate).toUTCString());

          expect(conditionalResponse.status).to.equal(304);
          expect(conditionalResponse.text).to.be.empty;
        });

        it('returns 200 with the archive when If-Modified-Since is before the release date', async () => {
          const conditionalResponse = await request.get(DOWNLOAD_URL).set('If-Modified-Since', new Date('2025-12-31T00:00:00Z').toUTCString());

          expect(conditionalResponse.status).to.equal(200);
        });

        it('returns a JSON error with 412 status code when If-Match does not match the archive checksum', async () => {
          const conditionalResponse = await request.get(DOWNLOAD_URL).set('If-Match', '"another-checksum"');

          expect(conditionalResponse.status).to.equal(412);
          expect(conditionalResponse.type).to.equal('application/json');
          expect(conditionalResponse.headers).to.not.have.any.keys('content-disposition', 'last-modified');
          expect(conditionalResponse.body).to.deep.equal({ error: 'Precondition Failed' });
        });
      });

      describe('with a range request', () => {
        it('returns the requested bytes with 206 status code', async () => {
          const rangeResponse = await request.get(DOWNLOAD_URL).set('Range', 'bytes=0-4').buffer(true).parse(binaryParser);

          expect(rangeResponse.status).to.equal(206);
          expect(rangeResponse.headers['content-range']).to.equal(`bytes 0-4/${ARCHIVE_CONTENT.length}`);
          expect(rangeResponse.body.equals(ARCHIVE_CONTENT.subarray(0, 5))).to.be.true;
        });

        it('returns a JSON error with 416 status code when the range cannot be satisfied', async () => {
          const rangeResponse = await request.get(DOWNLOAD_URL).set('Range', `bytes=${ARCHIVE_CONTENT.length}-`);

          expect(rangeResponse.status).to.equal(416);
          expect(rangeResponse.type).to.equal('application/json');
          expect(rangeResponse.headers['content-range']).to.equal(`bytes */${ARCHIVE_CONTENT.length}`);
          expect(rangeResponse.headers).to.not.have.any.keys('content-disposition', 'last-modified');
          expect(rangeResponse.headers.etag).to.not.equal(`"${METADATA.sha256}"`);
          expect(rangeResponse.body).to.deep.equal({ error: 'Range Not Satisfiable' });
        });

        it('returns 200 with the full archive when If-Range does not match the current archive', async () => {
          const rangeResponse = await request.get(DOWNLOAD_URL).set('If-Range', '"stale-checksum"').set('Range', 'bytes=0-4').buffer(true)
            .parse(binaryParser);

          expect(rangeResponse.status).to.equal(200);
          expect(rangeResponse.body.equals(ARCHIVE_CONTENT)).to.be.true;
        });
      });

      describe('with a HEAD request', () => {
        it('returns the archive headers without its content', async () => {
          const headResponse = await request.head(DOWNLOAD_URL);

          expect(headResponse.status).to.equal(200);
          expect(headResponse.headers['content-length']).to.equal(String(ARCHIVE_CONTENT.length));
          expect(headResponse.headers.etag).to.equal(`"${METADATA.sha256}"`);
          expect(headResponse.text).to.be.oneOf([ undefined, '' ]);
        });
      });
    });

    context('when the archive file name starts with a dot', () => {
      const DOTFILE_ARCHIVE_FILENAME = '.weekly-2026-01-01.zip';

      before(async () => {
        await fs.mkdir(storage.path, { recursive: true });
        await fs.writeFile(storage.archivePath(DOTFILE_ARCHIVE_FILENAME), ARCHIVE_CONTENT);
        await storage.save({ ...METADATA, filename: DOTFILE_ARCHIVE_FILENAME });
        response = await request.get(DOWNLOAD_URL).buffer(true).parse(binaryParser);
      });

      after(removeDataset);

      it('responds with 200 status code', () => {
        expect(response.status).to.equal(200);
      });

      it('returns the archive content', () => {
        expect(response.body.equals(ARCHIVE_CONTENT)).to.be.true;
      });
    });
  });

  describe('GET /dataset', () => {
    it('responds with 404 status code', async () => {
      const response = await request.get(`${basePath}/v1/dataset`);

      expect(response.status).to.equal(404);
    });
  });
});
