import path from 'path';

import config from 'config';

import { toISODateWithoutMilliseconds } from '../../src/archivist/utils/date.js';
import { SPDX_LICENSE_ID } from '../../src/dataset/license.js';
import DatasetStorage from '../../src/dataset/storage.js';

import generateRelease from './export/index.js';
import logger from './logger/index.js';
import publishRelease from './publish/index.js';

export async function release({ shouldPublish, fileName }) {
  const releaseDate = new Date();
  const title = config.get('@opentermsarchive/engine.dataset.title');
  const storage = new DatasetStorage(config.get('@opentermsarchive/engine.dataset.storagePath'));
  const archiveName = fileName || `${title.toLowerCase().replace(/[^a-zA-Z0-9.\-_]/g, '-')}-${releaseDate.toISOString().replace(/T.*/, '')}`;
  const filename = `${path.basename(archiveName, '.zip')}.zip`; // allow to pass filename or filename.zip as the archive name and have filename.zip as the result name
  const archivePath = storage.archivePath(filename);

  logger.info('Start exporting dataset…');

  const stats = await generateRelease({ archivePath, releaseDate });

  await storage.save({
    filename,
    title,
    license: SPDX_LICENSE_ID,
    releaseDate: toISODateWithoutMilliseconds(releaseDate),
    firstVersionDate: toISODateWithoutMilliseconds(stats.firstVersionDate),
    lastVersionDate: toISODateWithoutMilliseconds(stats.lastVersionDate),
    servicesCount: stats.servicesCount,
    termsCount: stats.termsCount,
    versionsCount: stats.versionsCount,
    size: stats.size,
    sha256: stats.sha256,
  });

  await storage.removePreviousArchives().catch(error => logger.warn(`Failed to remove previous dataset archives: ${error.message}`)); // The new dataset is already saved and servable; do not fail the release over stale files left behind

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
}
