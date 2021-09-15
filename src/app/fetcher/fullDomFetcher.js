import { InaccessibleContentError } from '../errors.js';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import config from 'config';
import { getRandomProxy } from './proxy.js';
import puppeteer from 'puppeteer-extra';
import useProxy from 'puppeteer-page-proxy';

puppeteer.use(StealthPlugin());

const PUPPETEER_TIMEOUT = 60 * 1000; // 60s
const MAX_RETRIES = 3;
let browser;

export default async function fetch(url, cssSelectors, headers = {}, { retry } = { retry: 0 }) {
  let response;
  let content;
  let page;
  const selectors = [].concat(cssSelectors);

  try {
    if (!browser) {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    page = await browser.newPage();

    if (retry > 0 && process.env.NODE_ENV !== 'test') {
      try {
        const randomProxy = await getRandomProxy();
        await useProxy(page, randomProxy);
        console.log(`Retry ${retry} with proxy ${randomProxy} for url ${url}`);
      } catch (e) {
        console.error('Could not use proxy');
      }
    }
    await page.setDefaultNavigationTimeout(PUPPETEER_TIMEOUT);

    await page.setExtraHTTPHeaders({
      ...headers,
    });

    response = await page.goto(url, { waitUntil: 'networkidle0' });

    if (!response) {
      if (retry === MAX_RETRIES) {
        throw new InaccessibleContentError(`Response is empty when trying to fetch '${url}'`);
      }
      return await fetch(url, cssSelectors, headers, { retry: retry + 1 });
    }

    const statusCode = response.status();

    if (statusCode < 200 || (statusCode >= 300 && statusCode !== 304)) {
      throw new InaccessibleContentError(
        `Received HTTP code ${statusCode} when trying to fetch '${url}'`
      );
    }

    await Promise.all(
      selectors.map((selector) =>
        page.waitForSelector(selector, { timeout: config.get('fetcher.waitForElementsTimeout') })
      )
    );

    content = await page.content();
  } catch (error) {
    if (
      (error.message.includes('Received HTTP code 403') ||
        error.message.includes('Received HTTP code 404') ||
        error.message.includes('Navigation timeout')) &&
      retry < MAX_RETRIES &&
      process.env.NODE_ENV !== 'test'
    ) {
      console.warn(`Error ${error.message} on url ${url}, retrying again ${retry + 1} times`);

      return await fetch(url, cssSelectors, headers, { retry: retry + 1 });
    }

    if (
      (error.code && error.code.match(/^(EAI_AGAIN|ENOTFOUND|ETIMEDOUT|ECONNRESET)$/)) ||
      (error.message &&
        error.message.match(/(ERR_FAILED|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED)/)) ||
      error instanceof puppeteer.pptr.errors.TimeoutError // Expected elements are not present on the web page
    ) {
      throw new InaccessibleContentError(error.message);
    }

    throw error;
  } finally {
    if (page) {
      await page.close();
    }
  }

  return {
    mimeType: 'text/html',
    content,
  };
}
