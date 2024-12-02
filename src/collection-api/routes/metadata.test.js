import fs from 'fs/promises';

import { expect } from 'chai';
import config from 'config';
import request from 'supertest';

import app from '../server.js';

const basePath = config.get('@opentermsarchive/engine.collection-api.basePath');
const { version: engineVersion } = JSON.parse(await fs.readFile(new URL('../../../package.json', import.meta.url)));

const EXPECTED_RESPONSE = {
  totalServices: 7,
  totalTerms: 8,
  id: 'test',
  name: 'test',
  tagline: 'Test collection',
  description: 'This is a test collection used for testing purposes.',
  dataset: 'https://github.com/OpenTermsArchive/test-versions/releases',
  declarations: 'https://github.com/OpenTermsArchive/test-declarations',
  versions: 'https://github.com/OpenTermsArchive/test-versions',
  snapshots: 'https://github.com/OpenTermsArchive/test-snapshots',
  donations: null,
  logo: 'https://opentermsarchive.org/images/logo/logo-open-terms-archive-black.png',
  languages: [
    'en',
  ],
  jurisdictions: [
    'EU',
  ],
  governance: {
    hosts: [
      { name: 'Localhost' },
    ],
    administrators: [
      {
        name: 'Open Terms Archive',
        url: 'https://opentermsarchive.org/',
        logo: 'https://opentermsarchive.org/images/logo/logo-open-terms-archive-black.png',
      },
    ],
    curators: [
      {
        name: 'Open Terms Archive',
        url: 'https://opentermsarchive.org/',
        logo: 'https://opentermsarchive.org/images/logo/logo-open-terms-archive-black.png',
      },
    ],
    maintainers: [
      {
        name: 'Open Terms Archive',
        url: 'https://opentermsarchive.org/',
        logo: 'https://opentermsarchive.org/images/logo/logo-open-terms-archive-black.png',
      },
    ],
    sponsors: [
      {
        name: 'Open Terms Archive',
        url: 'https://opentermsarchive.org/',
        logo: 'https://opentermsarchive.org/images/logo/logo-open-terms-archive-black.png',
      },
    ],
  },
};

describe('Metadata API', () => {
  describe('GET /metadata', () => {
    let response;

    before(async () => {
      response = await request(app).get(`${basePath}/v1/metadata`);
    });

    it('responds with 200 status code', () => {
      expect(response.status).to.equal(200);
    });

    it('responds with Content-Type application/json', () => {
      expect(response.type).to.equal('application/json');
    });

    it('returns expected metadata object', () => {
      expect(response.body).to.deep.equal({
        ...EXPECTED_RESPONSE,
        engineVersion,
      });
    });
  });
});
