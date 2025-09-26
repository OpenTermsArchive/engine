import puppeteer from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(stealthPlugin());

let browser;

export default async function fetch(url, cssSelectors, config) {
  let page;
  let client;
  let response;
  const selectors = [].concat(cssSelectors);

  if (!browser) {
    throw new Error('The headless browser should be controlled manually with "launchHeadlessBrowser" and "stopHeadlessBrowser".');
  }

  try {
    page = await browser.newPage();

    await page.setDefaultNavigationTimeout(config.navigationTimeout);
    await page.setExtraHTTPHeaders({ 'Accept-Language': config.language });

    await page.setCacheEnabled(false); // Disable cache to ensure fresh content on each fetch and prevent stale data from previous requests
    client = await page.target().createCDPSession();

    await client.send('Network.clearBrowserCookies'); // Clear cookies to ensure clean state between fetches and prevent session persistence across different URLs

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
    // Clean up CDP session first to prevent memory leaks. CDP sessions maintain persistent
    // connections to Chrome's debugging interface and must be explicitly detached to avoid
    // keeping references to browser internals that prevent proper garbage collection
    if (client) {
      await client.detach().catch(); // Ignore CDP session cleanup errors
    }

    if (page) {
      await page.close().catch(); // Ignore page close errors
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

  browser = await puppeteer.launch({ headless: true });

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

  try {
    // Close all pages first to ensure clean shutdown. Each page holds significant resources
    // that must be explicitly released: DOM trees, JavaScript contexts, network connections,
    // and CDP sessions. Closing pages before browser shutdown prevents race conditions where
    // the browser terminates while pages are still active, which can lead to memory leaks
    // and orphaned processes. This defensive approach ensures all page-level resources are
    // properly cleaned up before browser-level termination.
    const pages = await browser.pages();

    await Promise.all(pages.map(page => {
      if (!page.isClosed()) {
        return page.close().catch(); // Ignore errors when closing individual pages
      }

      return Promise.resolve(); // Return resolved promise for already closed pages
    }));

    await browser.close();
  } catch (error) {
    console.warn('Error during browser cleanup, attempting force kill:', error);

    // Force kill browser process if normal close fails
    try {
      const browserProcess = browser.process();

      if (browserProcess && !browserProcess.killed) {
        browserProcess.kill('SIGKILL');
      }
    } catch (killError) {
      console.warn('Failed to force kill browser process:', killError);
    }
  } finally {
    browser = null;
  }
}
