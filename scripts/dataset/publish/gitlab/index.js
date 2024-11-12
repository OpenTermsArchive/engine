import fsApi from 'fs';
import path from 'path';

import config from 'config';
import dotenv from 'dotenv';
import FormData from 'form-data';
import nodeFetch from 'node-fetch';

import GitLab from '../../../../src/reporter/gitlab/index.js';
import * as readme from '../../assets/README.template.js';
import logger from '../../logger/index.js';

dotenv.config();

export default async function publish({
  archivePath,
  releaseDate,
  stats,
}) {
  let projectId = null;
  const gitlabAPIUrl = config.get('@opentermsarchive/engine.dataset.apiBaseURL');

  const [ owner, repo ] = new URL(config.get('@opentermsarchive/engine.dataset.versionsRepositoryURL'))
    .pathname
    .split('/')
    .filter(Boolean);
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
    logger.error(`Error while obtaining projectId: ${error}`);
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

    // Upload the package
    options = GitLab.baseOptionsHttpReq(process.env.OTA_ENGINE_GITLAB_RELEASES_TOKEN);
    options.method = 'PUT';
    options.body = fsApi.createReadStream(archivePath);

    // restrict characters to the ones allowed by GitLab APIs
    const packageName = config.get('@opentermsarchive/engine.dataset.title').replace(/[^a-zA-Z0-9.\-_]/g, '-');
    const packageVersion = tagName.replace(/[^a-zA-Z0-9.\-_]/g, '-');
    const packageFileName = archivePath.replace(/[^a-zA-Z0-9.\-_/]/g, '-');

    logger.debug(`packageName: ${packageName}, packageVersion: ${packageVersion} packageFileName: ${packageFileName}`);

    const packageResponse = await nodeFetch(
      `${gitlabAPIUrl}/projects/${projectId}/packages/generic/${packageName}/${packageVersion}/${packageFileName}?status=default&select=package_file`,
      options,
    );
    const packageRes = await packageResponse.json();

    const packageFilesId = packageRes.id;

    logger.debug(`package file id: ${packageFilesId}`);

    // use the package id to build the download url for the release
    const publishedPackageUrl = `${config.get('@opentermsarchive/engine.dataset.versionsRepositoryURL')}/-/package_files/${packageFilesId}/download`;

    // Create the release and link the package
    const formData = new FormData();

    formData.append('name', archivePath);
    formData.append('url', publishedPackageUrl);
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
