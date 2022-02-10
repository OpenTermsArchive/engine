import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import generateRelease from './export/index.js';
import logger from './logger/index.js';
import publishRelease from './publish/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function release({ shouldPublish, shouldRemoveLocalCopy, fileName }) {
  const releaseDate = new Date();
  const archiveName = fileName || `dataset-${releaseDate.toISOString().replace(/T.*/, '')}`;
  const archivePath = `${__dirname}/${path.basename(archiveName, '.zip')}.zip`; // Allow to pass both `filename` and `filename.zip` as args without having duplicated extension

  logger.info('Start exporting dataset…');

  const stats = await generateRelease({ archivePath, releaseDate });

  logger.info(`Dataset exported in ${archivePath}`);

  if (!shouldPublish) {
    return;
  }

  logger.info('Start publishing dataset…');

  const releaseUrl = await publishRelease({
    archivePath,
    releaseDate,
    stats,
  });

  logger.info(`Dataset published to ${releaseUrl}`);

  if (!shouldRemoveLocalCopy) {
    return;
  }

  fs.unlinkSync(archivePath);

  logger.info(`Removed local copy ${archivePath}`);
}
