import schedule from 'node-schedule';

import * as notifier from './src/notifier/index.js';
import CGUs from './src/index.js';

(async () => {
  try {
    const rule = new schedule.RecurrenceRule();
    rule.minute = 30; // at minute 30 past every hour.

    console.log('The scheduler is running…');
    console.log('Jobs will run at minute 30 past every hour.');

    const app = new CGUs();
    await app.init();

    await notifier.init(app.serviceProviders, app.documentsTypes);

    app.on('sanitizedDocumentChange', notifier.onSanitizedDocumentChange);
    app.on('documentScrapingError', notifier.onDocumentScrapingError);

    schedule.scheduleJob(rule, app.updateTerms);
  } catch (error) {
    console.log(error);
  }
})();
