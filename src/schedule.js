import schedule from 'node-schedule';

import CGUs from './app/index.js';
import * as logger from './logger/index.js';
import Notifier from './notifier/index.js';

(async () => {
  try {
    const rule = new schedule.RecurrenceRule();
    rule.minute = 30; // at minute 30 past every hour.

    console.log('The scheduler is running…');
    console.log('Documents will be tracked at minute 30 past every hour.');

    const app = new CGUs();
    await app.init();
    await app.attach(logger);
    await app.refilterAndRecord();

    const notifier = new Notifier(app.serviceDeclarations);
    await app.attach(notifier);

    schedule.scheduleJob(rule, () => {
      app.trackChanges();
    });
  } catch (error) {
    console.error(error);
  }
})();
