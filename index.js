import scrape from './src/scraper/index.js';
import { persistRaw } from './src/history/index.js';

(async () => {
  try {
    const result = await scrape('https://www.facebook.com/legal/terms/plain_text_terms');
    persistRaw('facebook', 'terms_of_service', result);
  } catch (e) {
    console.log(e);
  }
})();
