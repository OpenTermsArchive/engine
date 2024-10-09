// Copyright (c) 2024 European Union
// *
// Licensed under the EUPL, Version 1.2 or – as soon they will be approved by the
// European Commission – subsequent versions of the EUPL (the “Licence”);
// You may not use this work except in compliance with the Licence.
// You may obtain a copy of the Licence at:
// *
// https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
// *
// Unless required by applicable law or agreed to in writing, software distributed under
// the Licence is distributed on an “AS IS” basis, WITHOUT WARRANTIES OR CONDITIONS
// OF ANY KIND, either express or implied. See the Licence for the specific language
// governing permissions and limitations under the Licence.
//
// EUPL text (EUPL-1.2)

import fsApi from 'fs';
import path from 'path';
import url from 'url';

import config from 'config';
import dotenv from 'dotenv';
import FormData from 'form-data';
import nodeFetch from 'node-fetch';

import GitLab from '../../../src/reporterGitlab/gitlab.js';
import * as readme from '../assets/README.template.js';
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
