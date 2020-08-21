import scheduler from 'node-schedule';

import CGUs from './app/index.js';
import * as logger from './logger/index.js';
import Notifier from './notifier/index.js';

(async () => {
  try {
    const serviceId = process.argv.slice(process.argv.indexOf('--serviceId'))[1];
    const refilterOnly = process.argv.indexOf('--refilter-only') != -1;
    const schedule = process.argv.indexOf('--schedule') != -1;

    const app = new CGUs();
    await app.init();
    await app.attach(logger);

    await app.refilterAndRecord(serviceId);

    if (refilterOnly) {
      return;
    }

    if (schedule) {
      const rule = new scheduler.RecurrenceRule();
      rule.minute = 30; // at minute 30 past every hour.

      const notifier = new Notifier(app.serviceDeclarations);
      await app.attach(notifier);

      console.log('The scheduler is running…');
      console.log('Documents will be tracked at minute 30 past every hour.');
      scheduler.scheduleJob(rule, () => {
        app.trackChanges(serviceId);
      });
    } else {
      await app.trackChanges(serviceId);
    }
  } catch (error) {
    console.error(error);
  }
})();
