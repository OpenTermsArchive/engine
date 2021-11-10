import config from 'config';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgent from 'user-agents';

import { FetchError } from './errors.js';

puppeteer.use(StealthPlugin());

const PUPPETEER_TIMEOUT = 30 * 1000; // 30 seconds in ms
const MAX_RETRIES = 3;
let browser;

export default async function fetch(url, cssSelectors, { retry } = { retry: 0 }) {
  let page;
  let response;
  let content;
  const selectors = [].concat(cssSelectors);

  if (!browser) {
    throw new Error('The headless browser should be controlled manually with "launchHeadlessBrowser" and "stopHeadlessBrowser".');
  }

  try {
    page = await browser.newPage();
    await page.setUserAgent(new UserAgent().toString());
    await page.setDefaultNavigationTimeout(PUPPETEER_TIMEOUT);

    response = await page.goto(url, { waitUntil: 'networkidle0' });

    if (!response) {
      if (retry === MAX_RETRIES) {
        throw new FetchError(`Response is empty when trying to fetch '${url}'`);
      }

      return await fetch(url, cssSelectors, { retry: retry + 1 });
    }

    const statusCode = response.status();

    if (statusCode < 200 || (statusCode >= 300 && statusCode !== 304)) {
      throw new FetchError(`Received HTTP code ${statusCode} when trying to fetch '${url}'`);
    }

    await Promise.all(selectors.map(selector => page.waitForSelector(selector, { timeout: config.get('fetcher.waitForElementsTimeout') })));

    content = await page.content();

    return {
      mimeType: 'text/html',
      content,
    };
  } catch (error) {
    throw new FetchError(error.message);
  } finally {
    if (page) {
      await page.close();
    }
  }
}

export async function launchHeadlessBrowser() {
  if (browser) {
    return;
  }

  browser = await puppeteer.launch({
    headless: true,
    args: [ '--no-sandbox', '--disable-setuid-sandbox' ]
  });
}

export async function stopHeadlessBrowser() {
  if (!browser) {
    return;
  }

  await browser.close();
  browser = null;
}
