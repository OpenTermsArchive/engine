import CGUs from './app/index.js';
import * as logger from './logger/index.js';

(async () => {
  try {
    const serviceId = process.argv.slice(2)[0];
    const app = new CGUs();
    await app.init();
    await app.attach(logger);
    await app.refilterAndRecord(serviceId);
  } catch (error) {
    console.error(error);
  }
})();
