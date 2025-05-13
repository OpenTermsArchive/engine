import config from 'config';

import { FetchDocumentError } from './errors.js';
import fetchFullDom from './fullDomFetcher.js';
import fetchHtmlOnly from './htmlOnlyFetcher.js';

export { launchHeadlessBrowser, stopHeadlessBrowser } from './fullDomFetcher.js';
export { FetchDocumentError } from './errors.js';

export const FETCHER_TYPES = {
  FULL_DOM: 'fullDom',
  HTML_ONLY: 'htmlOnly',
};

const LIKELY_BOT_BLOCKING_ERRORS = [
  'HTTP code 403',
  'HTTP code 406',
  'HTTP code 502',
];

/**
 * Fetch a resource from the network, returning a promise which is fulfilled once the response is available
 * @function fetch
 * @param   {object}                                                  params                                 Fetcher parameters
 * @param   {string}                                                  params.url                             URL of the resource you want to fetch
 * @param   {boolean}                                                 [params.executeClientScripts]          Enable execution of client scripts. When set to `true`, this property loads the page in a headless browser to load all assets and execute client scripts before returning its content. If undefined, the engine will automatically balance performance and tracking success rate, defaulting to not executing scripts and escalating to headless browser if needed
 * @param   {string|Array}                                            [params.cssSelectors]                  List of CSS selectors to await when loading the resource in a headless browser. Can be a CSS selector or an array of CSS selectors. Only relevant when `executeClientScripts` is enabled
 * @param   {object}                                                  [params.config]                        Fetcher configuration
 * @param   {number}                                                  [params.config.navigationTimeout]      Maximum time (in milliseconds) to wait before considering the fetch failed
 * @param   {string}                                                  [params.config.language]               Language (in [ISO 639-1 format](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)) to be passed in request headers
 * @param   {number}                                                  [params.config.waitForElementsTimeout] Maximum time (in milliseconds) to wait for selectors to exist on page before considering the fetch failed. Only relevant when `executeClientScripts` is enabled
 * @returns {Promise<{ mimeType: string, content: string | Buffer }>}                                        Promise containing the fetched resource's MIME type and content
 * @async
 */
export default async function fetch({
  url, executeClientScripts, cssSelectors,
  config: {
    navigationTimeout = config.get('@opentermsarchive/engine.fetcher.navigationTimeout'),
    language = config.get('@opentermsarchive/engine.fetcher.language'),
    waitForElementsTimeout = config.get('@opentermsarchive/engine.fetcher.waitForElementsTimeout'),
  } = {},
}) {
  try {
    if (executeClientScripts) {
      const result = await fetchFullDom(url, cssSelectors, { navigationTimeout, language, waitForElementsTimeout });

      return { ...result, fetcher: FETCHER_TYPES.FULL_DOM };
    }

    try {
      const result = await fetchHtmlOnly(url, { navigationTimeout, language });

      return { ...result, fetcher: FETCHER_TYPES.HTML_ONLY };
    } catch (error) {
      const mayBeBotBlocking = LIKELY_BOT_BLOCKING_ERRORS.some(code => error.message.includes(code));

      if (!mayBeBotBlocking || executeClientScripts === false) {
        throw error;
      }

      const result = await fetchFullDom(url, cssSelectors, { navigationTimeout, language, waitForElementsTimeout });

      return { ...result, fetcher: FETCHER_TYPES.FULL_DOM };
    }
  } catch (error) {
    throw new FetchDocumentError(error.message);
  }
}
