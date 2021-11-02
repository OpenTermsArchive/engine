import config from 'config';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgent from 'user-agents';

import logger from '../../logger/index.js';
import { InaccessibleContentError } from '../errors.js';

puppeteer.use(StealthPlugin());

const PUPPETEER_TIMEOUT = 30 * 1000; // 30 seconds in ms
const MAX_RETRIES = 3;
let browser;

export default async function fetch(url, cssSelectors, headers = {}, { retry } = { retry: 0 }) {
  let response;
  let content;
  let page;
  const selectors = [].concat(cssSelectors);

  try {
    if (!browser) {
      browser = await puppeteer.launch({ headless: true, args: [ '--no-sandbox', '--disable-setuid-sandbox' ] });
    }
    const userAgent = new UserAgent();

    page = await browser.newPage();
    await page.setUserAgent(userAgent.toString());
    await page.setDefaultNavigationTimeout(PUPPETEER_TIMEOUT);
    await page.setExtraHTTPHeaders({ ...headers });

    response = await page.goto(url, { waitUntil: 'networkidle0' });

    if (!response) {
      if (retry === MAX_RETRIES) {
        throw new InaccessibleContentError(`Response is empty when trying to fetch '${url}'`);
      }

      return await fetch(url, cssSelectors, headers, { retry: retry + 1 });
    }

    const statusCode = response.status();

    if (statusCode < 200 || (statusCode >= 300 && statusCode !== 304)) {
      throw new InaccessibleContentError(`Received HTTP code ${statusCode} when trying to fetch '${url}'`);
    }

    await Promise.all(selectors.map(selector => page.waitForSelector(selector, { timeout: config.get('fetcher.waitForElementsTimeout') })));

    content = await page.content();

    return {
      mimeType: 'text/html',
      content,
    };
  } catch (error) {
    if (error instanceof puppeteer.pptr.errors.TimeoutError) { // Expected elements are not present on the web page
      throw new InaccessibleContentError(error.message);
    }

    throw error;
  } finally {
    if (page) {
      await page.close();
    }
  }
}
