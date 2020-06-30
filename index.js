import * as notifier from './src/notifier/index.js';
import CGUs from './src/index.js';

(async () => {
  try {
    const app = new CGUs();
    await app.init();

    notifier.init(app.serviceProviders, app.documentsTypes);

    app.on('sanitizedDocumentChange', notifier.onSanitizedDocumentChange);
    app.on('documentScrapingError', notifier.onDocumentScrapingError);
    app.on('applicationError', notifier.onApplicationError);

    await app.updateTerms();
  } catch (e) {
    console.log(e);
  }
})();
