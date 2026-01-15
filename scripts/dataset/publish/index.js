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

  const succeeded = [];
  const failed = [];

  // Execute publications sequentially to avoid memory issues with large file uploads
  for (const platform of platforms) {
    try {
      const url = await platform.publish();

      succeeded.push({ platform: platform.name, url });
    } catch (error) {
      failed.push({ platform: platform.name, error });
    }
  }

  if (failed.length) {
    let errorMessage = !succeeded.length ? 'All platforms failed to publish:' : 'Some platforms failed to publish:';

    failed.forEach(({ platform, error }) => {
      errorMessage += `\n  - ${platform}: ${error.message}`;
    });

    logger.error(errorMessage);
  }

  return succeeded;
}
