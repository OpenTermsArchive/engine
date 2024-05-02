import puppeteer from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteerExtra.use(stealthPlugin());

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
    if (error instanceof puppeteer.errors.TimeoutError) {
      throw new Error(`Timed out after ${config.navigationTimeout / 1000} seconds when trying to fetch '${url}'`);
    }
    throw new Error(error.message);
  } finally {
    if (page) {
      await page.close();
    }
  }
}

export async function launchHeadlessBrowser() {
  if (browser) {
    return browser;
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
