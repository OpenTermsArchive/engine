import fsApi from 'fs';
import path from 'path';
import url from 'url';

import axios from 'axios';
import config from 'config';
import dotenv from 'dotenv';
import FormData from 'form-data';

import * as readme from '../assets/README.templateGitLab.js';
import logger from '../logger/index.js';

dotenv.config();

const gitlabAPIUrl = 'https://gitlab.com/api/v4';
const gitlabUrl = 'https://gitlab.com';

export default async function publishReleaseGitLab({
  archivePath,
  releaseDate,
  stats,
}) {
  let projectId = null;

  // const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const [ owner, repo ] = url
    .parse(config.get('@opentermsarchive/engine.dataset.versionsRepositoryURLGitLab'))
    .pathname.split('/')
    .filter(component => component);
  const commonParams = { owner, repo };

  try {
    const repositoryPath = `${commonParams.owner}/${commonParams.repo}`;
    const response = await axios.get(
      `${gitlabAPIUrl}/projects/${encodeURIComponent(repositoryPath)}`,
      { headers: { Authorization: `Bearer ${process.env.OTA_ENGINE_GITLAB_RELEASES_TOKEN}` } },
    );

    projectId = response.data.id;
  } catch (error) {
    // logger.error(`🤖  Error while obtaining projectId: ${error}`);
    projectId = null;
  }

  const tagName = `${path.basename(archivePath, path.extname(archivePath))}`; // use archive filename as Git tag

  try {
    // First, create the release
    const releaseResponse = await axios.post(
      `${gitlabAPIUrl}/projects/${projectId}/releases`,
      {
        ref: 'main',
        tag_name: tagName,
        name: readme.title({ releaseDate }),
        description: readme.body(stats),
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OTA_ENGINE_GITLAB_RELEASES_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const releaseId = releaseResponse.data.commit.id;

    logger.info(`Created release with releaseId: ${releaseId}`);

    // Then, upload the ZIP file as an asset to the release
    const formData = new FormData();

    formData.append('name', archivePath);
    formData.append(
      'url',
      `${gitlabUrl}/${commonParams.owner}/${commonParams.repo}/-/archive/${tagName}/${archivePath}`,
    );
    formData.append('file', fsApi.createReadStream(archivePath), { filename: path.basename(archivePath) });

    const uploadResponse = await axios.post(
      `${gitlabAPIUrl}/projects/${projectId}/releases/${tagName}/assets/links`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${process.env.OTA_ENGINE_GITLAB_RELEASES_TOKEN}`,
        },
      },
    );

    const releaseUrl = uploadResponse.data.direct_asset_url;

    return releaseUrl;
  } catch (error) {
    logger.error('Failed to create release or upload ZIP file:', error);
    throw error;
  }
}
