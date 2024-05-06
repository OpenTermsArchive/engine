import fsApi from 'fs';
import path from 'path';
import url from 'url';

import config from 'config';
import { Octokit } from 'octokit';

import * as readme from '../assets/README.template.js';

export default async function publish({ archivePath, releaseDate, stats }) {
  const octokit = new Octokit({ auth: process.env.OTA_ENGINE_GITHUB_TOKEN });

  const [ owner, repo ] = url.parse(config.get('@opentermsarchive/engine.dataset.versionsRepositoryURL')).pathname.split('/').filter(component => component);

  const tagName = `${path.basename(archivePath, path.extname(archivePath))}`; // use archive filename as Git tag

  const { data: { upload_url: uploadUrl, html_url: releaseUrl } } = await octokit.rest.repos.createRelease({
    owner,
    repo,
    tag_name: tagName,
    name: readme.title({ releaseDate }),
    body: readme.body(stats),
  });

  await octokit.rest.repos.uploadReleaseAsset({
    data: fsApi.readFileSync(archivePath),
    headers: {
      'content-type': 'application/zip',
      'content-length': fsApi.statSync(archivePath).size,
    },
    name: path.basename(archivePath),
    url: uploadUrl,
  });

  return releaseUrl;
}
