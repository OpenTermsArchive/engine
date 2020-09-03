import scheduler from 'node-schedule';

import CGUs from './app/index.js';
import * as logger from './logger/index.js';
import Notifier from './notifier/index.js';

(async () => {
  const serviceId = process.argv.slice(process.argv.indexOf('--serviceId'))[1];
  const refilterOnly = process.argv.indexOf('--refilter-only') != -1;
  const schedule = process.argv.indexOf('--schedule') != -1;
  const app = new CGUs();
  app.attach(logger);
  await app.init();

  logger.info('Refiltering documents… (it could take a while)');
  await app.refilterAndRecord(serviceId);
  logger.info('Refiltering done.\n');

  if (refilterOnly) {
    return;
  }

  if (!schedule) {
    logger.info('Start tracking changes…');
    await app.trackChanges(serviceId);
    return logger.info('Tracking changes done.');
  }

  const rule = new scheduler.RecurrenceRule();
  rule.minute = 30; // at minute 30 past every hour.

  app.attach(new Notifier(app.serviceDeclarations));

  logger.info('The scheduler is running…');
  logger.info('Documents will be tracked at minute 30 past every hour.');
  scheduler.scheduleJob(rule, async () => {
    logger.info('Start tracking changes…');
    await app.trackChanges(serviceId);
    logger.info('Tracking changes done.');
  });
})();
