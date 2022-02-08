import fsApi from 'fs';
import path from 'path';
import url from 'url';

import config from 'config';
import dotenv from 'dotenv';
import { Octokit } from 'octokit';

import * as readme from '../assets/README.template.js';

dotenv.config();

const locale = 'en-EN';
const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };

export default async function publish({ archivePath, releaseDate, servicesCount, firstCommitDate, lastCommitDate }) {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const [ owner, repo ] = url.parse(config.get('dataset.versionsRepositoryURL')).pathname.split('/').filter(element => element !== '');

  const tagName = `${path.basename(archivePath, path.extname(archivePath))}`; // use archive filename as Git tag

  const { data: { upload_url: uploadUrl, html_url: releaseUrl } } = await octokit.rest.repos.createRelease({
    owner,
    repo,
    tag_name: tagName,
    name: readme.title({
      servicesRepositoryName: config.get('dataset.servicesRepositoryName'),
      releaseDate: releaseDate.toLocaleDateString(locale, dateOptions),
    }),
    body: readme.body({
      servicesCount,
      firstCommitDate,
      lastCommitDate,
      versionsRepositoryURL: config.get('dataset.versionsRepositoryURL'),
    }),
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

  return { releaseUrl };
}
