import fsApi from 'fs';
import path from 'path';
import url from 'url';

import config from 'config';
import dotenv from 'dotenv';
import FormData from 'form-data';
import nodeFetch from 'node-fetch';

import GitLab from '../../../src/reporterGitlab/gitlab.js';
import * as readme from '../assets/README.templateGitLab.js';
import logger from '../logger/index.js';

dotenv.config();

const gitlabAPIUrl = process.env.OTA_ENGINE_GITLAB_API_BASE_URL;
const gitlabUrl = process.env.OTA_ENGINE_GITLAB_BASE_URL;

export default async function publishReleaseGitLab({
  archivePath,
  releaseDate,
  stats,
}) {
  let projectId = null;

  const [ owner, repo ] = url
    .parse(config.get('@opentermsarchive/engine.dataset.versionsRepositoryURLGitLab'))
    .pathname.split('/')
    .filter(component => component);
  const commonParams = { owner, repo };

  try {
    const repositoryPath = `${commonParams.owner}/${commonParams.repo}`;

    const options = GitLab.baseOptionsHttpReq(process.env.OTA_ENGINE_GITLAB_RELEASES_TOKEN);

    options.method = 'GET';
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await nodeFetch(
      `${gitlabAPIUrl}/projects/${encodeURIComponent(repositoryPath)}`,
      options,
    );
    const res = await response.json();

    projectId = res.id;
  } catch (error) {
    logger.error(`🤖  Error while obtaining projectId: ${error}`);
    projectId = null;
  }

  const tagName = `${path.basename(archivePath, path.extname(archivePath))}`; // use archive filename as Git tag

  try {
    let options = GitLab.baseOptionsHttpReq(process.env.OTA_ENGINE_GITLAB_RELEASES_TOKEN);

    options.method = 'POST';
    options.body = {
      ref: 'main',
      tag_name: tagName,
      name: readme.title({ releaseDate }),
      description: readme.body(stats),
    };
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    options.body = JSON.stringify(options.body);

    const releaseResponse = await nodeFetch(
      `${gitlabAPIUrl}/projects/${projectId}/releases`,
      options,
    );
    const releaseRes = await releaseResponse.json();

    const releaseId = releaseRes.commit.id;

    logger.info(`Created release with releaseId: ${releaseId}`);

    // Then, upload the ZIP file as an asset to the release
    const formData = new FormData();

    formData.append('name', archivePath);
    formData.append(
      'url',
      `${gitlabUrl}/${commonParams.owner}/${commonParams.repo}/-/archive/${tagName}/${archivePath}`,
    );
    formData.append('file', fsApi.createReadStream(archivePath), { filename: path.basename(archivePath) });

    options = GitLab.baseOptionsHttpReq(process.env.OTA_ENGINE_GITLAB_RELEASES_TOKEN);
    options.method = 'POST';
    options.headers = {
      ...formData.getHeaders(),
      ...options.headers,
    };
    options.body = formData;

    const uploadResponse = await nodeFetch(
      `${gitlabAPIUrl}/projects/${projectId}/releases/${tagName}/assets/links`,
      options,
    );
    const uploadRes = await uploadResponse.json();

    const releaseUrl = uploadRes.direct_asset_url;

    return releaseUrl;
  } catch (error) {
    logger.error('Failed to create release or upload ZIP file:', error);
    throw error;
  }
}
