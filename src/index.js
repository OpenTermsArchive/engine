import dotenv from 'dotenv';
dotenv.config();

import scrape from './scraper/index.js';
import { persistRaw } from './history/index.js';

export async function updateTerms() {
  console.log('Start scraping and saving terms of service…')
  const result = await scrape('https://www.facebook.com/legal/terms/plain_text_terms');
  return persistRaw('facebook', 'terms_of_service', result);
}
