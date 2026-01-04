import fs from 'fs';
import path from 'path';

import config from 'config';

import generateRelease from './export/index.js';
import logger from './logger/index.js';
import publishRelease from './publish/index.js';

export async function release({ shouldPublish, shouldRemoveLocalCopy, fileName }) {
  const releaseDate = new Date();
  const archiveName = fileName || `${config.get('@opentermsarchive/engine.dataset.title').toLowerCase().replace(/[^a-zA-Z0-9.\-_]/g, '-')}-${releaseDate.toISOString().replace(/T.*/, '')}`;
  const archivePath = `${path.basename(archiveName, '.zip')}.zip`; // allow to pass filename or filename.zip as the archive name and have filename.zip as the result name

  logger.info('Start exporting dataset…');

  const stats = await generateRelease({ archivePath, releaseDate });

  logger.info(`Dataset exported in ${archivePath}`);

  if (!shouldPublish) {
    return;
  }

  logger.info('Start publishing dataset…');

  const results = await publishRelease({
    archivePath,
    releaseDate,
    stats,
  });
  if (results.length > 0) {
    logger.info('Dataset published to following platforms:');
    results.forEach(result => {
      logger.info(`  - ${result.platform}: ${result.url}`);
    });
  }
  if (!shouldRemoveLocalCopy) {
    return;
  }

  fs.unlinkSync(archivePath);
  logger.info(`Removed local copy ${archivePath}`);
}
