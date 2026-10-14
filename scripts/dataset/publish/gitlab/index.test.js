import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { expect } from 'chai';
import config from 'config';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import nock from 'nock';

import publish, { baseOptionsHttpReq } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { origin: API_ORIGIN, pathname: API_PATH } = new URL(config.get('@opentermsarchive/engine.dataset.apiBaseURL'));
const PROJECT_PATH = 'OpenTermsArchive/sandbox-versions';
const PROJECT_ID = 1;
const ARCHIVE_NAME = 'sandbox-2026-01-01';
const ARCHIVE_FILENAME = `${ARCHIVE_NAME}.zip`;
const TMP_PATH = path.resolve(__dirname, './tmp');
const ARCHIVE_PATH = path.join(TMP_PATH, ARCHIVE_FILENAME);
const DIRECT_ASSET_URL = 'https://gitlab.example.test/download/42';
const TOKEN = 'token';
const AUTHENTICATED = { reqheaders: { authorization: `Bearer ${TOKEN}` } };
const STATS = {
  servicesCount: 2,
  firstVersionDate: new Date('2021-01-01T00:00:00Z'),
  lastVersionDate: new Date('2022-01-06T00:00:00Z'),
};

describe('GitLab dataset publisher', () => {
  describe('#publish', () => {
    let packageUploadScope;
    let assetLinkScope;
    let result;
    let previousToken;

    before(async function () {
      this.timeout(5000);
      previousToken = process.env.OTA_ENGINE_GITLAB_RELEASES_TOKEN;
      process.env.OTA_ENGINE_GITLAB_RELEASES_TOKEN = TOKEN;

      await fs.mkdir(TMP_PATH, { recursive: true });
      await fs.writeFile(ARCHIVE_PATH, 'archive content'); // Plain text keeps the multipart body inspectable: nock hands binary bodies to matchers as hex strings

      nock(API_ORIGIN, AUTHENTICATED)
        .get(`${API_PATH}/projects/${encodeURIComponent(PROJECT_PATH)}`)
        .reply(200, { id: PROJECT_ID });

      nock(API_ORIGIN, AUTHENTICATED)
        .post(`${API_PATH}/projects/${PROJECT_ID}/releases`)
        .reply(201, { commit: { id: 'sha' } });

      packageUploadScope = nock(API_ORIGIN, AUTHENTICATED)
        .put(`${API_PATH}/projects/${PROJECT_ID}/packages/generic/sandbox/${ARCHIVE_NAME}/${ARCHIVE_FILENAME}`)
        .query({ status: 'default', select: 'package_file' })
        .reply(201, { id: 42 });

      assetLinkScope = nock(API_ORIGIN, AUTHENTICATED)
        .post(`${API_PATH}/projects/${PROJECT_ID}/releases/${ARCHIVE_NAME}/assets/links`, body => body.includes(`name="name"\r\n\r\n${ARCHIVE_FILENAME}\r\n`))
        .reply(201, { direct_asset_url: DIRECT_ASSET_URL });

      result = await publish({
        archivePath: ARCHIVE_PATH,
        releaseDate: new Date('2026-01-01T08:30:00Z'),
        stats: STATS,
      });
    });

    after(async () => {
      nock.cleanAll();

      if (previousToken === undefined) {
        delete process.env.OTA_ENGINE_GITLAB_RELEASES_TOKEN;
      } else {
        process.env.OTA_ENGINE_GITLAB_RELEASES_TOKEN = previousToken;
      }

      await fs.rm(TMP_PATH, { recursive: true, force: true });
    });

    it('uploads the package under the archive file name', () => {
      expect(packageUploadScope.isDone()).to.be.true;
    });

    it('links the release asset under the archive file name', () => {
      expect(assetLinkScope.isDone()).to.be.true;
    });

    it('returns the direct asset URL', () => {
      expect(result).to.equal(DIRECT_ASSET_URL);
    });
  });

  describe('#baseOptionsHttpReq', () => {
    const PROXY_VARIABLES = [ 'HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy' ];
    const PROXY_URL = 'http://proxy.example.test:8080';
    let previousValues;

    beforeEach(() => {
      previousValues = Object.fromEntries(PROXY_VARIABLES.map(name => [ name, process.env[name] ]));
      PROXY_VARIABLES.forEach(name => delete process.env[name]);
    });

    afterEach(() => {
      PROXY_VARIABLES.forEach(name => {
        if (previousValues[name] === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = previousValues[name];
        }
      });
    });

    context('without any proxy', () => {
      it('does not set any agent', () => {
        expect(baseOptionsHttpReq('https://gitlab.example.test/api/v4').agent).to.be.undefined;
      });
    });

    context('with a lowercase HTTPS proxy', () => {
      it('reaches an HTTPS API through it', () => {
        process.env.https_proxy = PROXY_URL;

        expect(baseOptionsHttpReq('https://gitlab.example.test/api/v4').agent).to.be.an.instanceof(HttpsProxyAgent);
      });
    });

    context('with an HTTP proxy only', () => {
      it('reaches an HTTPS API by tunnelling through it', () => {
        process.env.HTTP_PROXY = PROXY_URL;

        expect(baseOptionsHttpReq('https://gitlab.example.test/api/v4').agent).to.be.an.instanceof(HttpsProxyAgent);
      });

      it('reaches an HTTP API through it', () => {
        process.env.HTTP_PROXY = PROXY_URL;

        expect(baseOptionsHttpReq('http://gitlab.example.test/api/v4').agent).to.be.an.instanceof(HttpProxyAgent);
      });
    });
  });
});
