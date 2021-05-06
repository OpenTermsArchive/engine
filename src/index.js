import './bootstrap.js';

import scheduler from 'node-schedule';
import * as services from './app/services/index.js';

import CGUs from './app/index.js';
import Notifier from './notifier/index.js';
import logger from './logger/index.js';
import { publishRelease } from '../scripts/release/releasedataset.js';

const args = process.argv.slice(2);
const modifiedOnly = args.includes('--modified-only');
const refilterOnly = args.includes('--refilter-only');
const schedule = args.includes('--schedule');

(async () => {
  const app = new CGUs();
  app.attach(logger);
  await app.init();

  let serviceIds = args.filter((arg) => !arg.startsWith('--') && arg !== '/home/debian/cgus/');

  if (modifiedOnly) {
    serviceIds = await services.getIdsOfModified();
  }

  serviceIds = serviceIds.filter((serviceId) => {
    const isServiceDeclared = app.serviceDeclarations[serviceId];
    if (!isServiceDeclared) {
      logger.warn(`Service ${serviceId} does not exist and will be ignored.`);
    }

    return isServiceDeclared;
  });

  if (modifiedOnly && !serviceIds.length) {
    logger.warn('No services have been modified');
    return;
  }

  serviceIds = serviceIds.length ? serviceIds : app.serviceIds;

  const numberOfDocuments = serviceIds.reduce(
    (acc, serviceId) => acc + app.serviceDeclarations[serviceId].getNumberOfDocuments(),
    0
  );

  logger.info(`Refiltering ${numberOfDocuments} documents from ${serviceIds.length} services…`);
  await app.refilterAndRecord(serviceIds);
  logger.info(`Refiltered ${numberOfDocuments} documents from ${serviceIds.length} services.\n`);

  if (refilterOnly) {
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    app.attach(new Notifier(app.serviceDeclarations));
  }

  logger.info(
    `Start tracking changes of ${numberOfDocuments} documents from ${serviceIds.length} services…`
  );
  await app.trackChanges(serviceIds);
  logger.info(
    `Tracked changes of ${numberOfDocuments} documents from ${serviceIds.length} services.`
  );

  logger.info(`Start Release ${new Date()}`);
  await publishRelease();
  logger.info(`End Release ${new Date()}`);

  if (!schedule) {
    return;
  }

  logger.info('The scheduler is running…');
  logger.info('Documents will be tracked at minute 30 past every 2 hours.');
  scheduler.scheduleJob('30 */2 * * *', async () => {
    logger.info(
      `Start tracking changes of ${numberOfDocuments} documents from ${serviceIds.length} services…`
    );
    await app.trackChanges(serviceIds);
    logger.info(
      `Tracked changes of ${numberOfDocuments} documents from ${serviceIds.length} services.`
    );
  });

  logger.info('Release will be created if needed every night at 1:20am');
  scheduler.scheduleJob('20 15 * * *', async () => {
    logger.info(`Start Release ${new Date()}`);
    await publishRelease();
    logger.info(`End Release ${new Date()}`);
  });
})();
