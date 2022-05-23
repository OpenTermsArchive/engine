import config from 'config';
import puppeteer from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

import { FetchDocumentError } from './errors.js';

puppeteerExtra.use(stealthPlugin());

let browser;

export default async function fetch(url, cssSelectors, options) {
  let page;
  let response;
  const selectors = [].concat(cssSelectors);

  if (!browser) {
    throw new Error('The headless browser should be controlled manually with "launchHeadlessBrowser" and "stopHeadlessBrowser".');
  }

  try {
    page = await browser.newPage();

    await page.setDefaultNavigationTimeout(options.navigationTimeout);
    await page.setExtraHTTPHeaders({ 'Accept-Language': options.language });

    response = await page.goto(url, { waitUntil: 'networkidle0' });

    if (!response) {
      throw new FetchDocumentError(`Response is empty when trying to fetch '${url}'`);
    }

    const statusCode = response.status();

    if (statusCode < 200 || (statusCode >= 300 && statusCode !== 304)) {
      throw new FetchDocumentError(`Received HTTP code ${statusCode} when trying to fetch '${url}'`);
    }

    const waitForSelectorsPromises = selectors.map(selector => page.waitForSelector(selector, { timeout: options.waitForElementsTimeout }));

    // We expect all elements to be present on the page…
    await Promise.all(waitForSelectorsPromises).catch(error => {
      if (error.name == 'TimeoutError') {
        // however, if they are not, this is not considered as an error since selectors may be out of date
        // and the whole content of the page should still be returned.
        return;
      }

      throw error;
    });

    return {
      mimeType: 'text/html',
      content: await page.content(),
    };
  } catch (error) {
    if (error instanceof puppeteer.errors.TimeoutError) {
      throw new FetchDocumentError(`Timed out after ${options.navigationTimeout / 1000} seconds when trying to fetch '${url}'`);
    }
    throw new FetchDocumentError(error.message);
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

  browser = await puppeteerExtra.launch({ headless: true });

  return browser;
}

export async function stopHeadlessBrowser() {
  if (!browser) {
    return;
  }

  await browser.close();
  browser = null;
}
