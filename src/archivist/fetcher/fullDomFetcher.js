import { TimeoutError } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(stealthPlugin());

let browser;

export default async function fetch(url, cssSelectors, config) {
  let page;
  let response;
  const selectors = [].concat(cssSelectors);

  if (!browser) {
    throw new Error('The headless browser should be controlled manually with "launchHeadlessBrowser" and "stopHeadlessBrowser".');
  }

  try {
    page = await browser.newPage();

    await page.setDefaultNavigationTimeout(config.navigationTimeout);
    await page.setExtraHTTPHeaders({ 'Accept-Language': config.language });

    response = await page.goto(url, { waitUntil: 'networkidle0' });

    if (!response) {
      throw new Error(`Response is empty when trying to fetch '${url}'`);
    }

    const statusCode = response.status();

    if (statusCode < 200 || (statusCode >= 300 && statusCode !== 304)) {
      throw new Error(`Received HTTP code ${statusCode} when trying to fetch '${url}'`);
    }

    const waitForSelectorsPromises = selectors.map(selector => page.waitForSelector(selector, { timeout: config.waitForElementsTimeout }));

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
    if (error instanceof TimeoutError) {
      throw new Error(`Timed out after ${config.navigationTimeout / 1000} seconds when trying to fetch '${url}'`);
    }
    throw new Error(error.message);
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * Launches a headless browser instance if one is not already running
 * @async
 * @returns {Promise<Browser>} The Puppeteer browser instance
 * @description Initializes and returns a headless browser instance using Puppeteer.
 * If a browser instance already exists, returns the existing instance instead of creating a new one.
 */
export async function launchHeadlessBrowser() {
  if (browser) {
    return browser;
  }

  browser = await puppeteer.launch({ headless: true });

  return browser;
}

/**
 * Stops the headless browser instance if one is running
 * @async
 * @returns {Promise<void>}
 * @description Closes the browser instance
 * If no browser instance exists, this function does nothing.
 */
export async function stopHeadlessBrowser() {
  if (!browser) {
    return;
  }

  await browser.close();
  browser = null;
}
