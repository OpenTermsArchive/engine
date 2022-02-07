import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import generateRelease from './export/index.js';
import logger from './logger/index.js';
import publishRelease from './publish/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function release({ publicationEnabled, removeLocalCopyEnabled, fileName }) {
  const releaseDate = new Date();
  const archiveName = fileName || `dataset-${releaseDate.toISOString().replace(/T.*Z/, '')}`;
  const archivePath = `${__dirname}/${path.basename(archiveName, '.zip')}.zip`; // Allow to pass both `filename` and `filename.zip` as args without having duplicated extension

  const { servicesCount, firstCommitDate, lastCommitDate } = await generate({ archivePath, releaseDate });

  if (!publicationEnabled) {
    return;
  }

  return publish({ archivePath, releaseDate, servicesCount, firstCommitDate, lastCommitDate, publicationEnabled, removeLocalCopyEnabled });
}

export async function generate({ archivePath, releaseDate }) {
  logger.info('Start exporting dataset…');

  const { servicesCount, firstCommitDate, lastCommitDate } = await generateRelease({ archivePath, releaseDate });

  logger.info(`Dataset exported in ${archivePath}`);

  return { servicesCount, firstCommitDate, lastCommitDate };
}

export async function publish({ archivePath, releaseDate, servicesCount, firstCommitDate, lastCommitDate, removeLocalCopyEnabled }) {
  logger.info('Start publishing dataset…');

  const { releaseUrl } = await publishRelease({
    archivePath,
    releaseDate,
    servicesCount,
    firstCommitDate,
    lastCommitDate,
  });

  logger.info(`Dataset published to ${releaseUrl}`);

  if (!removeLocalCopyEnabled) {
    return;
  }

  fs.unlinkSync(archivePath);

  logger.info(`Removed local copy ${archivePath}`);
}
