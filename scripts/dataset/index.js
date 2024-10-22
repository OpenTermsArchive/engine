import fs from 'fs';
import path from 'path';

import config from 'config';

import generateRelease from './export/index.js';
import logger from './logger/index.js';
import publishRelease from './publish/index.js';
import publishReleaseGitLab from './publishGitLab/index.js';

export async function release({ shouldPublish, shouldRemoveLocalCopy, fileName }) {
  const releaseDate = new Date();
  const archiveName = fileName || `dataset-${config.get('@opentermsarchive/engine.dataset.title')}-${releaseDate.toISOString().replace(/T.*/, '')}`;
  const archivePath = `${path.basename(archiveName, '.zip')}.zip`; // allow to pass filename or filename.zip as the archive name and have filename.zip as the result name

  logger.info('Start exporting dataset…');

  const usesGitHub = (typeof process.env.OTA_ENGINE_GITHUB_TOKEN !== 'undefined');
  const usesGitLab = (typeof process.env.OTA_ENGINE_GITLAB_TOKEN !== 'undefined');

  let versionsRepositoryURL = '';

  if (usesGitHub) versionsRepositoryURL = config.get('@opentermsarchive/engine.dataset.versionsRepositoryURL');
  if (usesGitLab) versionsRepositoryURL = config.get('@opentermsarchive/engine.dataset.versionsRepositoryURLGitLab');

  const stats = await generateRelease({ archivePath, releaseDate, versionsRepositoryURL });

  logger.info(`Dataset exported in ${archivePath}`);

  if (!shouldPublish) {
    return;
  }

  logger.info('Start publishing dataset…');

  if (usesGitHub) {
    const releaseUrl = await publishRelease({
      archivePath,
      releaseDate,
      stats,
    });

    logger.info(`Dataset published to ${releaseUrl}`);
  }

  if (usesGitLab) {
    const releaseUrl = await publishReleaseGitLab({
      archivePath,
      releaseDate,
      stats,
    });

    logger.info(`Dataset published to ${releaseUrl}`);
  }

  if (!shouldRemoveLocalCopy) {
    return;
  }

  fs.unlinkSync(archivePath);

  logger.info(`Removed local copy ${archivePath}`);
}
