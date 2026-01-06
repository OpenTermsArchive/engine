import config from 'config';

import logger from '../logger/index.js';

import publishDataGouv from './datagouv/index.js';
import publishGitHub from './github/index.js';
import publishGitLab from './gitlab/index.js';

export default async function publishRelease({ archivePath, releaseDate, stats }) {
  const platforms = [];

  // If both GitHub and GitLab tokens are defined, GitHub takes precedence
  if (process.env.OTA_ENGINE_GITHUB_TOKEN) {
    platforms.push({ name: 'GitHub', publish: () => publishGitHub({ archivePath, releaseDate, stats }) });
  } else if (process.env.OTA_ENGINE_GITLAB_TOKEN) {
    platforms.push({ name: 'GitLab', publish: () => publishGitLab({ archivePath, releaseDate, stats }) });
  }

  if (process.env.OTA_ENGINE_DATAGOUV_API_KEY) {
    platforms.push({ name: 'data.gouv.fr', publish: () => publishDataGouv({ archivePath, releaseDate, stats }) });
  }

  if (!platforms.length) {
    throw new Error('No publishing platform configured. Please configure at least one of: GitHub (OTA_ENGINE_GITHUB_TOKEN), GitLab (OTA_ENGINE_GITLAB_TOKEN), or data.gouv.fr (OTA_ENGINE_DATAGOUV_API_KEY + datasetId or organizationIdOrSlug in config).');
  }

  const results = await Promise.allSettled(platforms.map(async platform => {
    const url = await platform.publish();

    return { platform: platform.name, url };
  }));

  const succeeded = results.filter(result => result.status === 'fulfilled');
  const failed = results.filter(result => result.status === 'rejected');

  if (failed.length) {
    let errorMessage = !succeeded.length ? 'All platforms failed to publish:' : 'Some platforms failed to publish:';

    failed.forEach(rejectedResult => {
      const index = results.indexOf(rejectedResult);

      errorMessage += `\n  - ${platforms[index].name}: ${rejectedResult.reason.message}`;
    });

    logger.error(errorMessage);
  }

  return succeeded.map(result => result.value);
}
