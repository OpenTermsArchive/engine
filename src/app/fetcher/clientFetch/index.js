import puppeteer from 'puppeteer';
import config from 'config';

import { InaccessibleContentError } from '../../errors.js';

export default async function fetch(url, cssSelectors) {
  let response;
  let content;
  let browser;
  let page;
  const selector = Array.isArray(cssSelectors) ? cssSelectors.join(', ') : cssSelectors;

  try {
    browser = await puppeteer.launch();
    page = await browser.newPage();

    response = await page.goto(url);
    const statusCode = response.status();

    if (statusCode < 200 || statusCode >= 300) {
      throw new InaccessibleContentError(`Received HTTP code ${statusCode} when trying to fetch '${url}'`);
    }

    await page.waitForSelector(selector, { timeout: config.get('fetcher.waitForElementsTimeout') });

    content = await page.content();
  } catch (error) {
    if (
      error.code == 'ENOTFOUND'
    || error.code == 'ETIMEDOUT'
    || error.message.includes('ERR_TUNNEL_CONNECTION_FAILED')
    || error.message.includes('ERR_NAME_NOT_RESOLVED')
    || error instanceof puppeteer.errors.TimeoutError // Expected elements are not present on the web page
    ) {
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
    content,
  };
}
