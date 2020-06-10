import dotenv from 'dotenv';
dotenv.config();

import consoleStamp from 'console-stamp';
consoleStamp(console);

import scrape from './scraper/index.js';
import { persistRaw, persistSanitized } from './history/index.js';
import sanitize from './sanitizer/index.js';

export default async function updateTerms() {
  console.log('Start scraping and saving terms of service…')
  const content = await scrape('https://www.facebook.com/legal/terms/plain_text_terms');
  await persistRaw('facebook', 'terms_of_service', content);
  const sanitizedContent = await sanitize(content, '.UIFullPage_Container');
  await persistSanitized('facebook', 'terms_of_service', sanitizedContent);
};
