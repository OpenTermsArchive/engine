import puppeteer from 'puppeteer';
import { InaccessibleContentError } from '../errors.js';

export default async function fetch(url, selector) {
  let response;
  const args = { headless: true };

  try {
    const browser = await puppeteer.launch(args);
    const page = await browser.newPage();
    await page.goto(url);
    await page.waitForSelector(selector, { timeout: 1000 });
    response = await page.content();
    await browser.close();
  } catch (error) {
    if (error.code == 'ENOTFOUND' || error.code == 'ETIMEDOUT') {
      throw new InaccessibleContentError(error.message);
    }
    throw error;
  }

  return {
    mimeType: 'text/html',
    content: response,
  };
}
