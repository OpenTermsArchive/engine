import config from 'config';

import { FetchDocumentError } from './errors.js';
import fetchFullDom from './fullDomFetcher.js';
import fetchHtmlOnly from './htmlOnlyFetcher.js';

export { launchHeadlessBrowser, stopHeadlessBrowser } from './fullDomFetcher.js';
export { FetchDocumentError } from './errors.js';

/**
 * Fetch a resource from the network, returning a promise which is fulfilled once the response is available
 *
 * @function fetch
 * @param {Object} params - Fetcher parameters
 * @param {string} params.url - URL of the resource you want to fetch
 * @param {boolean} [params.executeClientScripts] - Enable execution of client scripts. When set to `true`, this property loads the page in a headless browser to load all assets and execute client scripts before returning its content
 * @param {string|Array} [params.cssSelectors] - List of CSS selectors to await when loading the resource in a headless browser. Can be a CSS selector or an array of CSS selectors. Only relevant when `executeClientScripts` is enabled
 * @param {Object} [params.config] - Fetcher configuration
 * @param {number} [params.config.navigationTimeout] - Maximum time (in milliseconds) to wait before considering the fetch failed
 * @param {string} [params.config.language] - Language (in [ISO 639-1 format](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)) to be passed in request headers
 * @param {number} [params.config.waitForElementsTimeout] - Maximum time (in milliseconds) to wait for selectors to exist on page before considering the fetch failed. Only relevant when `executeClientScripts` is enabled
 * @returns {Promise} @returns {Promise<Object>} Promise which will be resolved with an object containing the `mimeType` and the `content` of the URL as string or Buffer
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
      return await fetchFullDom(url, cssSelectors, { navigationTimeout, language, waitForElementsTimeout });
    }

    return await fetchHtmlOnly(url, { navigationTimeout, language });
  } catch (error) {
    throw new FetchDocumentError(error.message);
  }
}
