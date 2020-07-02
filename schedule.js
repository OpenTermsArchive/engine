import schedule from 'node-schedule';

import Notifier from './src/notifier/index.js';
import CGUs from './src/index.js';

(async () => {
  try {
    const rule = new schedule.RecurrenceRule();
    rule.minute = 30; // at minute 30 past every hour.

    console.log('The scheduler is running…');
    console.log('Jobs will run at minute 30 past every hour.');

    const app = new CGUs();
    const notifier = new Notifier(app.serviceProviders, app.documentsTypes);

    app.on('sanitizedDocumentChange', notifier.onSanitizedDocumentChange.bind(notifier));
    app.on('documentScrapingError', notifier.onDocumentScrapingError.bind(notifier));
    app.on('applicationError', notifier.onApplicationError.bind(notifier));

    schedule.scheduleJob(rule, app.updateTerms);
  } catch (error) {
    console.log(error);
  }
})();
