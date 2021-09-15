import { InaccessibleContentError } from '../errors.js';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import config from 'config';
import { getRandomProxy } from './proxy.js';
import puppeteer from 'puppeteer-extra';
import useProxy from 'puppeteer-page-proxy';

puppeteer.use(StealthPlugin());

const PUPPETEER_TIMEOUT = 60 * 1000; // 60s

let browser;

export default async function fetch(url, cssSelectors, headers = {}, { retry } = { retry: 3 }) {
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
    console.log(''); //eslint-disable-line
    console.log('╔════START══retry══════════════════════════════════════════════════'); //eslint-disable-line
    console.log(retry); //eslint-disable-line
    console.log(url, cssSelectors, headers); //eslint-disable-line
    console.log('╚════END════retry══════════════════════════════════════════════════'); //eslint-disable-line

    if (retry !== 0 && process.env.NODE_ENV !== 'test') {
      try {
        const randomProxy = await getRandomProxy();
        await useProxy(page, randomProxy);
      } catch (e) {
        console.error('Could not use proxy');
      }
    }
    await page.setDefaultNavigationTimeout(PUPPETEER_TIMEOUT);

    await page.setExtraHTTPHeaders({
      ...headers,
    });

    response = await page.goto(url, { waitUntil: 'networkidle0' });

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
    console.log(''); //eslint-disable-line
    console.log('╔════START══error══════════════════════════════════════════════════'); //eslint-disable-line
    console.log(url); //eslint-disable-line
    console.log(error); //eslint-disable-line
    console.log(error.message); //eslint-disable-line
    console.log('╚════END════error══════════════════════════════════════════════════'); //eslint-disable-line
    if (
      (error.message.includes('Received HTTP code 403') ||
        error.message.includes('Received HTTP code 404') ||
        error.message.includes('Navigation timeout')) &&
      retry !== 0 &&
      process.env.NODE_ENV !== 'test'
    ) {
      console.log('REFETCHING');

      return await fetch(url, cssSelectors, headers, { retry: retry - 1 });
    }
    console.log(''); //eslint-disable-line
    console.log('╔════START══error═after═════════════════════════════════════════════════'); //eslint-disable-line
    console.log(url); //eslint-disable-line
    console.log(error); //eslint-disable-line
    console.log(error.message); //eslint-disable-line
    console.log('╚════END════error══════════════════════════════════════════════════'); //eslint-disable-line

    if (
      (error.code && error.code.match(/^(EAI_AGAIN|ENOTFOUND|ETIMEDOUT|ECONNRESET)$/)) ||
      (error.message &&
        error.message.match(/(ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED)/)) ||
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
