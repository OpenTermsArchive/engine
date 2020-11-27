import scheduler from 'node-schedule';

import CGUs from './app/index.js';
import logger from './logger/index.js';
import Notifier from './notifier/index.js';

const args = process.argv.slice(2);
const refilterOnly = args.includes('--refilter-only');
const schedule = args.includes('--schedule');
let serviceIds = args.filter(arg => !arg.startsWith('--'));

(async () => {
  const app = new CGUs();
  app.attach(logger);
  await app.init();

  serviceIds = serviceIds.filter(serviceId => {
    const isServiceDeclared = app.serviceDeclarations[serviceId];
    if (!isServiceDeclared) {
      logger.warn(`Service ${serviceId} does not exist and will be ignored.`);
    }

    return isServiceDeclared;
  });

  serviceIds = serviceIds.length ? serviceIds : app.serviceIds;

  const numberOfDocuments = serviceIds.reduce((acc, serviceId) => acc + Object.keys(app.serviceDeclarations[serviceId].documents).length, 0);

  if (process.env.EXIT_AFTER) {
    setTimeout(() => {
      console.log('EXIT_AFTER', process.env.EXIT_AFTER);
      process.exit(0);
    }, process.env.EXIT_AFTER);
  }

  if (process.env.SKIP_REFILTER) {
    logger.info('Skipping refilter');
  } else {
    logger.info(`Refiltering ${numberOfDocuments} documents from ${serviceIds.length} services…`);
    await app.refilterAndRecord(serviceIds);
    logger.info(`Refiltered ${numberOfDocuments} documents from ${serviceIds.length} services.\n`);
  }

  if (refilterOnly) {
    return;
  }

  app.attach(new Notifier(app.serviceDeclarations));

  if (!schedule) {
    logger.info(`Start tracking changes of ${numberOfDocuments} documents from ${serviceIds.length} services…`);
    await app.trackChanges(serviceIds);
    return logger.info(`Tracked changes of ${numberOfDocuments} documents from ${serviceIds.length} services.`);
  }

  const rule = new scheduler.RecurrenceRule();
  rule.minute = 30; // at minute 30 past every hour.

  logger.info('The scheduler is running…');
  logger.info(`Documents will be tracked at minute ${rule.minute} past every hour.`);
  scheduler.scheduleJob(rule, async () => {
    logger.info(`Start tracking changes of ${numberOfDocuments} documents from ${serviceIds.length} services…`);
    await app.trackChanges(serviceIds);
    logger.info(`Tracked changes of ${numberOfDocuments} documents from ${serviceIds.length} services.`);
  });
})();
