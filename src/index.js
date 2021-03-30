import './bootstrap.js';

import scheduler from 'node-schedule';
import * as services from './app/services/index.js';

import CGUs from './app/index.js';
import Notifier from './notifier/index.js';
import logger from './logger/index.js';

const args = process.argv.slice(2);
const modifiedOnly = args.includes('--modified-only');
const refilterOnly = args.includes('--refilter-only');
const schedule = args.includes('--schedule');

(async () => {
  const app = new CGUs();
  app.attach(logger);
  await app.init();

  let serviceIds = args.filter((arg) => !arg.startsWith('--'));

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

  if (process.env.NODE_ENV == 'production') {
    app.attach(new Notifier(app.serviceDeclarations));
  }

  logger.info(
    `Start tracking changes of ${numberOfDocuments} documents from ${serviceIds.length} services…`
  );
  await app.trackChanges(serviceIds);
  logger.info(
    `Tracked changes of ${numberOfDocuments} documents from ${serviceIds.length} services.`
  );

  if (!schedule) {
    return;
  }

  const rule = new scheduler.RecurrenceRule();
  rule.minute = 30; // at minute 30 past every hour.

  logger.info('The scheduler is running…');
  logger.info(`Documents will be tracked at minute ${rule.minute} past every hour.`);
  scheduler.scheduleJob(rule, async () => {
    logger.info(
      `Start tracking changes of ${numberOfDocuments} documents from ${serviceIds.length} services…`
    );
    await app.trackChanges(serviceIds);
    logger.info(
      `Tracked changes of ${numberOfDocuments} documents from ${serviceIds.length} services.`
    );
  });
})();
