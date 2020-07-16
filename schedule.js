import schedule from 'node-schedule';

import Notifier from './src/notifier/index.js';
import CGUs from './src/index.js';

(async () => {
  try {
    const rule = new schedule.RecurrenceRule();
    rule.minute = 30; // at minute 30 past every hour.

    console.log('The scheduler is running…');
    console.log('Documents will be tracked at minute 30 past every hour.');

    const app = new CGUs();
    await app.init();

    const notifier = new Notifier(app.serviceDeclarations, app.documentTypes);

    app.on('versionRecorded', notifier.onVersionRecorded.bind(notifier));
    app.on('fetchingError', notifier.onDocumentFetchError.bind(notifier));
    app.on('error', notifier.onApplicationError.bind(notifier));

    schedule.scheduleJob(rule, () => {
      app.trackChanges();
    });
  } catch (error) {
    console.error(error);
  }
})();
