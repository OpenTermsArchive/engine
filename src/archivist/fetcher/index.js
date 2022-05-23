import fetchFullDom from './fullDomFetcher.js';
import fetchHtmlOnly from './htmlOnlyFetcher.js';

export { launchHeadlessBrowser, stopHeadlessBrowser } from './fullDomFetcher.js';
export { FetchDocumentError } from './errors.js';

/**
 * Fetch a resource from the network, returning a promise which is fulfilled once the response is available
 *
 * @param {Object} config - Fetcher configuration
 * @param {string} config.url - URL of the resource you want to fetch
 * @param {boolean} [config.executeClientScripts] - Enable execution of client scripts. When set to true, this boolean property loads the page in a headless browser to load all assets and execute client scripts before trying to get resource content
 * @param {string|Array} [config.cssSelectors] - List of CSS selectors to await for when loading resource in a headless browser. Can be a CSS selector or an array CSS selectors. Only relevant when `executeClientScripts` is enabled
 * @param {Object} [config.options] - Fetcher options
 * @param {number} [config.options.navigationTimeout=5000] - Maximum time (in milliseconds) to wait before considering the fetch failed.
 * @param {string} [config.options.language=en] - Language (in [ISO 639-1 format](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)) to be passed in request headers
 * @param {number} [config.options.waitForElementsTimeout=5000] - Maximum time (in milliseconds) to wait for selectors to exist on page before considering the fetch failed. Only relevant when `executeClientScripts` is enabled
 * @returns {Promise} Promise which is fulfilled once the resource is available. The promise will resolve into an object containing the mime type of the resource and its content, defined in `mimeType` and `content` keys
 */
export default async function fetch({ url, executeClientScripts, cssSelectors, options }) {
  if (executeClientScripts) {
    return fetchFullDom(url, cssSelectors, options);
  }

  return fetchHtmlOnly(url, options);
}
