import puppeteer from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import navigatorLanguages from 'puppeteer-extra-plugin-stealth/evasions/navigator.languages/index.js';
import userAgentOverride from 'puppeteer-extra-plugin-stealth/evasions/user-agent-override/index.js';

import { resolveProxyConfiguration, extractProxyCredentials } from './proxyUtils.js';

let browser;

export function parseLanguage(value) {
  if (typeof value !== 'string') {
    throw new Error(`Fetcher language must be a string; received ${JSON.stringify(value)}. Pass the value of "@opentermsarchive/engine.fetcher.language" explicitly.`);
  }

  if (value.toLowerCase().includes(';q=')) {
    throw new Error(`Quality factors are not supported in fetcher language configuration; received "${value}". Provide a comma-separated list of BCP 47 tags in priority order, for example "en-IE,en-GB,en".`);
  }

  const languages = value.split(',').map(tag => tag.trim()).filter(Boolean);

  if (!languages.length) {
    throw new Error(`Fetcher language must contain at least one tag; received "${value}".`);
  }

  return { locale: languages.join(','), languages };
}

export default async function fetch(url, cssSelectors, config) {
  if (!browser) {
    throw new Error('The headless browser should be controlled manually with "launchHeadlessBrowser" and "stopHeadlessBrowser".');
  }

  let context;
  let page;
  let client;

  try {
    context = await browser.createBrowserContext(); // Create an isolated browser context to ensure complete isolation between fetches (cookies, localStorage, sessionStorage, IndexedDB, cache)
    page = await context.newPage();
    client = await page.createCDPSession();

    await configurePage(page, config);

    const selectors = [].concat(cssSelectors).filter(Boolean);

    let pdf = {};
    let handled = null;

    if (!selectors.length) { // CSS selectors are specified only for HTML content and omitted when fetching a PDF
      ({ pdf, handled } = setupPdfInterception(client));
    }

    let response;
    let navigationAborted = false;

    try {
      response = await page.goto(url, { waitUntil: 'load' }); // Using `load` instead of `networkidle0` as it's more reliable and faster. The 'load' event fires when the page and all its resources (stylesheets, scripts, images) have finished loading. `networkidle0` can be problematic as it waits for 500ms of network inactivity, which may never occur on dynamic pages and then triggers a navigation timeout.
    } catch (error) {
      if (error.message.includes('net::ERR_ABORTED')) {
        // Chrome may sometimes abort navigation for files such as PDFs.
        // Do not throw for now; wait for the PDF interception handler to finish processing the response.
        navigationAborted = true;
      } else {
        throw error;
      }
    }

    // PDF interception handling
    if (handled) {
      await handled; // Wait for the interception callback to finish processing the response

      if (pdf.content) {
        return {
          mimeType: 'application/pdf',
          content: pdf.content,
        };
      }

      if (pdf.status) { // Status captured by CDP interception
        throw new Error(`Received HTTP code ${pdf.status} when trying to fetch '${url}'`);
      }
    }

    if (navigationAborted) {
      throw new Error(`Navigation aborted when trying to fetch '${url}'`);
    }

    if (!response) {
      throw new Error(`Response is empty when trying to fetch '${url}'`);
    }

    const statusCode = response.status();

    if (!isValidHttpStatus(statusCode)) {
      throw new Error(`Received HTTP code ${statusCode} when trying to fetch '${url}'`);
    }

    await waitForSelectors(page, selectors, config.waitForElementsTimeout);

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
    await cleanupPage(client, context);
  }
}

/**
 * Launches a headless browser instance using Puppeteer if one is not already running. Returns the existing browser instance if one is already running, otherwise creates and returns a new instance.
 * @function launchHeadlessBrowser
 * @param   {string}                     language Accept-Language header value applied to the browser context
 * @returns {Promise<puppeteer.Browser>}          The Puppeteer browser instance.
 * @async
 */
export async function launchHeadlessBrowser(language) {
  if (browser) {
    return browser;
  }

  const { locale, languages } = parseLanguage(language);
  const stealth = stealthPlugin();

  stealth.enabledEvasions.delete('user-agent-override');
  stealth.enabledEvasions.delete('navigator.languages');
  puppeteer.use(stealth);
  puppeteer.use(userAgentOverride({ locale }));
  puppeteer.use(navigatorLanguages({ languages }));

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

function isValidHttpStatus(status) {
  return (status >= 200 && status < 300) || status === 304;
}

async function configurePage(page, config) {
  await page.setViewport({ width: 1920, height: 1080 }); // Realistic viewport to avoid detection based on default Puppeteer dimensions (800x600)
  await page.setDefaultNavigationTimeout(config.navigationTimeout);

  if (browser.proxyCredentials?.username && browser.proxyCredentials?.password) {
    await page.authenticate(browser.proxyCredentials);
  }
}

function setupPdfInterception(client) {
  const pdf = { content: null, status: null };
  let onHandled;
  const handled = new Promise(resolve => { onHandled = resolve; });

  client.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Response' }] }); // Intercept all responses before Chrome processes them, allowing to capture PDF content before it's handled by the PDF viewer

  client.on('Fetch.requestPaused', async ({ requestId, resourceType, responseHeaders, responseStatusCode }) => {
    try {
      const contentType = responseHeaders?.find(header => header.name.toLowerCase() === 'content-type')?.value;

      if (!contentType?.includes('application/pdf')) {
        return;
      }

      pdf.status = responseStatusCode;

      if (!isValidHttpStatus(responseStatusCode)) {
        return;
      }

      try {
        const { body, base64Encoded } = await client.send('Fetch.getResponseBody', { requestId });

        pdf.content = Buffer.from(body, base64Encoded ? 'base64' : 'utf8');
      } catch {
        // Response body may be unavailable due to network error or connection interruption
      }
    } finally {
      try {
        await client.send('Fetch.continueResponse', { requestId });
      } catch {
        // Client may have been closed by cleanupPage() in fetch() while this async callback was still running
      }

      if (resourceType === 'Document') { // Signal that the main navigation request has been processed
        onHandled();
      }
    }
  });

  return { pdf, handled };
}

async function waitForSelectors(page, selectors, timeout) {
  const waitForSelectorsPromises = selectors.filter(Boolean).map(selector =>
    page.waitForFunction(
      cssSelector => {
        const element = document.querySelector(cssSelector); // eslint-disable-line no-undef

        return element?.textContent.trim().length; // Ensures element exists and has non-empty text
      },
      { timeout },
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
}

async function cleanupPage(client, context) {
  if (client) {
    await client.detach().catch(() => {});
  }
  if (context) {
    await context.close().catch(() => {}); // Closing the context disposes its page too; closing the page explicitly is not only redundant but can hang indefinitely when a navigation is still in flight, for instance after a navigation timeout
  }
}
