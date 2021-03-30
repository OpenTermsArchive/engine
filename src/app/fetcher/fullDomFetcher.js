import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import config from 'config';
import puppeteer from 'puppeteer-extra';
import { InaccessibleContentError } from '../errors.js';

puppeteer.use(StealthPlugin());

export default async function fetch(url, cssSelectors) {
  let response;
  let content;
  let browser;
  let page;
  const selectors = [].concat(cssSelectors);

  try {
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000); // 60s

    response = await page.goto(url);
    const statusCode = response.status();

    if (statusCode < 200 || statusCode >= 300) {
      throw new InaccessibleContentError(
        `Received HTTP code ${statusCode} when trying to fetch '${url}'`
      );
    }

    await Promise.all(
      selectors.map((selector) =>
        page.waitForSelector(selector, { timeout: config.get('fetcher.waitForElementsTimeout') }))
    );

    content = await page.content();
  } catch (error) {
    if (
      (error.code && error.code.match(/^(EAI_AGAIN|ENOTFOUND|ETIMEDOUT|ECONNRESET)$/))
      || (error.message
        && error.message.match(/(ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED)/))
      || error instanceof puppeteer.pptr.errors.TimeoutError // Expected elements are not present on the web page
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
