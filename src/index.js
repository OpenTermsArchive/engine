import path from 'path';
import { fileURLToPath } from 'url';

import config from 'config';
import scheduler from 'node-schedule';

import { publishRelease } from '../scripts/release/releasedataset.js';

import Archivist from './archivist/index.js';
import GitHub from './github/index.js';
import logger from './logger/index.js';
import Notifier from './notifier/index.js';
import GitAdapter from './storage-adapters/git/index.js';
import MongoAdapter from './storage-adapters/mongo/index.js';

const args = process.argv.slice(2);
const refilterOnly = args.includes('--refilter-only');
const schedule = args.includes('--schedule');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async function startOpenTermsArchive() {
  const { versionsStorageAdapter, snapshotsStorageAdapter } = initStorageAdapters();

  const archivist = new Archivist({
    storage: {
      versions: versionsStorageAdapter,
      snapshots: snapshotsStorageAdapter,
    },
  });

  archivist.attach(logger);
  await archivist.init();

  logger.info('Start Open Terms Archive\n');

  let serviceIds = args.filter(arg => !arg.startsWith('--'));

  serviceIds = serviceIds.filter(serviceId => {
    const isServiceDeclared = archivist.serviceDeclarations[serviceId];

    if (!isServiceDeclared) {
      logger.warn(`Service ${serviceId} does not exist and will be ignored.`);
    }

    return isServiceDeclared;
  });

  serviceIds = serviceIds.length ? serviceIds : archivist.serviceIds;

  const numberOfDocuments = serviceIds.reduce((acc, serviceId) => acc + archivist.serviceDeclarations[serviceId].getNumberOfDocuments(), 0);

  serviceIds = serviceIds.sort((a, b) => a.localeCompare(b));

  logger.info(`👇 Refiltering ${numberOfDocuments} documents from ${serviceIds.length} services…`);
  await archivist.refilterAndRecord(serviceIds);
  logger.info(`👆 Refiltered ${numberOfDocuments} documents from ${serviceIds.length} services.\n`);

  if (refilterOnly) {
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    archivist.attach(new Notifier(archivist.serviceDeclarations));
  }

  if (process.env.GITHUB_TOKEN) {
    archivist.attach(new GitHub());
  }

  logger.info(`👇 Start tracking changes of ${numberOfDocuments} documents from ${serviceIds.length} services…`);
  await archivist.trackChanges(serviceIds);
  logger.info(`👆 Tracked changes of ${numberOfDocuments} documents from ${serviceIds.length} services.`);

  if (!schedule) {
    return;
  }

  logger.info('The scheduler is running…');
  logger.info('Documents will be tracked at minute 30 past every 6 hours.');
  scheduler.scheduleJob('30 */6 * * *', async () => {
    logger.info(`Start tracking changes of ${numberOfDocuments} documents from ${serviceIds.length} services…`);
    await archivist.trackChanges(serviceIds);
    logger.info(`Tracked changes of ${numberOfDocuments} documents from ${serviceIds.length} services.`);
  });

  logger.info('Release will be created if needed every night at 4:15am');
  scheduler.scheduleJob('15 4 * * *', async () => {
    logger.info(`Start Release ${new Date()}`);
    await publishRelease();
    logger.info(`End Release ${new Date()}`);
  });
}());

function initStorageAdapters() {
  let versionsStorageAdapter;

  if (config.has('recorder.versions.storage.git')) {
    versionsStorageAdapter = new GitAdapter({
      ...config.get('recorder.versions.storage.git'),
      path: path.resolve(__dirname, '../', config.get('recorder.versions.storage.git.path')),
      fileExtension: 'md',
    });
  }

  if (config.has('recorder.versions.storage.mongo')) {
    versionsStorageAdapter = new MongoAdapter(config.get('recorder.versions.storage.mongo'));
  }

  let snapshotsStorageAdapter;

  if (config.has('recorder.snapshots.storage.git')) {
    snapshotsStorageAdapter = new GitAdapter({
      ...config.get('recorder.snapshots.storage.git'),
      path: path.resolve(__dirname, '../', config.get('recorder.snapshots.storage.git.path')),
      fileExtension: 'html',
    });
  }

  if (config.has('recorder.snapshots.storage.mongo')) {
    snapshotsStorageAdapter = new MongoAdapter(config.get('recorder.snapshots.storage.mongo'));
  }

  return {
    versionsStorageAdapter,
    snapshotsStorageAdapter,
  };
}
