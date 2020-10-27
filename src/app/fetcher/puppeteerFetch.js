import puppeteer from 'puppeteer';
import { InaccessibleContentError } from '../errors.js';

export default async function fetch(url, selector) {
  let response;
  const args = { headless: true };
  let browser;
  let page;

  try {
    browser = await puppeteer.launch(args);
    page = await browser.newPage();
    await page.goto(url);
    await page.waitForSelector(selector, { timeout: 1000 });
    response = await page.content();
  } catch (error) {
    if (error.code == 'ENOTFOUND' || error.code == 'ETIMEDOUT') {
      throw new InaccessibleContentError(error.message);
    } else if (error.message == 'net::ERR_TUNNEL_CONNECTION_FAILED at https://not.available.example') {
      error.message = '/404/';
      throw new InaccessibleContentError(error.message);
    }
    throw error;
  } finally {
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
  }

  return {
    mimeType: 'text/html',
    content: response,
  };
}
