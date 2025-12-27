import puppeteer from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

import { resolveProxyConfiguration, extractProxyCredentials } from './proxyUtils.js';

puppeteer.use(stealthPlugin());

let browser;

export default async function fetch(url, cssSelectors, config) {
  let context;
  let page;
  let response;
  const selectors = [].concat(cssSelectors);

  if (!browser) {
    throw new Error('The headless browser should be controlled manually with "launchHeadlessBrowser" and "stopHeadlessBrowser".');
  }

  try {
    context = await browser.createBrowserContext(); // Create an isolated browser context to ensure complete isolation between fetches (cookies, localStorage, sessionStorage, IndexedDB, cache)
    page = await context.newPage();

    await page.setDefaultNavigationTimeout(config.navigationTimeout);
    await page.setExtraHTTPHeaders({ 'Accept-Language': config.language });

    if (browser.proxyCredentials?.username && browser.proxyCredentials?.password) {
      await page.authenticate(browser.proxyCredentials);
    }

    response = await page.goto(url, { waitUntil: 'load' }); // Using `load` instead of `networkidle0` as it's more reliable and faster. The 'load' event fires when the page and all its resources (stylesheets, scripts, images) have finished loading. `networkidle0` can be problematic as it waits for 500ms of network inactivity, which may never occur on dynamic pages and then triggers a navigation timeout.

    if (!response) {
      throw new Error(`Response is empty when trying to fetch '${url}'`);
    }

    const statusCode = response.status();

    if (statusCode < 200 || (statusCode >= 300 && statusCode !== 304)) {
      throw new Error(`Received HTTP code ${statusCode} when trying to fetch '${url}'`);
    }

    const waitForSelectorsPromises = selectors.filter(Boolean).map(selector =>
      page.waitForFunction(
        cssSelector => {
          const element = document.querySelector(cssSelector); // eslint-disable-line no-undef

          return element?.textContent.trim().length; // Ensures element exists and contains non-empty text, as an empty element may indicate content is still loading
        },
        { timeout: config.waitForElementsTimeout },
        selector,
      ));

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
    if (error.name === 'TimeoutError') {
      throw new Error(`Timed out after ${config.navigationTimeout / 1000} seconds when trying to fetch '${url}'`);
    }
    throw new Error(error.message);
  } finally {
    if (page) {
      await page.close();
    }
    if (context) {
      await context.close(); // Close the isolated context to free resources and ensure complete cleanup
    }
  }
}

/**
 * Launches a headless browser instance using Puppeteer if one is not already running. Returns the existing browser instance if one is already running, otherwise creates and returns a new instance.
 * @function launchHeadlessBrowser
 * @returns {Promise<puppeteer.Browser>} The Puppeteer browser instance.
 * @async
 */
export async function launchHeadlessBrowser() {
  if (browser) {
    return browser;
  }

  const options = {
    args: [],
    headless: !process.env.OTA_ENGINE_FETCHER_NO_HEADLESS,
  };

  const { httpProxy, httpsProxy } = resolveProxyConfiguration();

  let proxyCredentials = null;

  if (httpProxy) {
    const httpProxyUrl = new URL(httpProxy);
    const httpsProxyUrl = new URL(httpsProxy);

    proxyCredentials = extractProxyCredentials(httpProxy, httpsProxy);

    options.args.push(`--proxy-server=http=${httpProxyUrl.host};https=${httpsProxyUrl.host}`);
  }

  if (process.env.OTA_ENGINE_FETCHER_NO_SANDBOX) {
    options.args.push('--no-sandbox');
    options.args.push('--disable-setuid-sandbox');
  }

  browser = await puppeteer.launch(options);

  if (proxyCredentials) {
    browser.proxyCredentials = proxyCredentials;
  }

  return browser;
}

/**
 * Stops the headless browser instance if one is running. If no instance exists, it does nothing.
 * @function stopHeadlessBrowser
 * @returns {Promise<void>}
 * @async
 */
export async function stopHeadlessBrowser() {
  if (!browser) {
    return;
  }

  await browser.close();
  browser = null;
}
