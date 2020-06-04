import scrape from './src/scraper/index.js';

(async () => {
  try {
    const result = await scrape('https://www.facebook.com/legal/terms/plain_text_terms');
    console.log(result);
  } catch (e) {
    console.log(e);
  }
})();
