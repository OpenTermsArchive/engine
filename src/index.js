import scheduler from 'node-schedule';

import CGUs from './app/index.js';
import * as logger from './logger/index.js';
import Notifier from './notifier/index.js';

const args = process.argv.slice(2);
const refilterOnly = args.includes('--refilter-only');
const schedule = args.includes('--schedule');
const services = args.filter(arg => !arg.startsWith('--'));

(async () => {
  const app = new CGUs();
  app.attach(logger);
  await app.init();

  logger.info('Refiltering documents… (it could take a while)');
  await app.refilterAndRecord(services);
  logger.info('Refiltering done.\n');

  if (refilterOnly) {
    return;
  }

  if (!schedule) {
    logger.info('Start tracking changes…');
    await app.trackChanges(services);
    return logger.info('Tracking changes done.');
  }

  const rule = new scheduler.RecurrenceRule();
  rule.minute = 30; // at minute 30 past every hour.

  app.attach(new Notifier(app.serviceDeclarations));

  logger.info('The scheduler is running…');
  logger.info('Documents will be tracked at minute 30 past every hour.');
  scheduler.scheduleJob(rule, async () => {
    logger.info('Start tracking changes…');
    await app.trackChanges(services);
    logger.info('Tracking changes done.');
  });
})();
