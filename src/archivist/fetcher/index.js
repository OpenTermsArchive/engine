import fetchFullDom from './fullDomFetcher.js';
import fetchHtmlOnly from './htmlOnlyFetcher.js';

export { launchHeadlessBrowser, stopHeadlessBrowser } from './fullDomFetcher.js';
export { FetchDocumentError } from './errors.js';

/**
 * Fetch url using headless browser or not and waiting for specific selectors to exist
 *
 * @param {Object} config - The fetcher config
 * @param {string} config.url - The url to be fetched
 * @param {boolean} [config.executeClientScripts] - Whether you want to use a headless browser are not
 * @param {string[]} [config.cssSelectors] - List of css selectors to await for (only when executeClientScripts is true)
 * @param {Object} [config.options] - The fetcher options
 * @param {number} [config.options.navigationTimeout=5000] - Time to wait before considering the fetch failed
 * @param {string} [config.options.language=en] - The language to be passed in headers
 * @param {number} [config.options.waitForElementsTimeout=5000] - Time to wait for selectors to exist on page before considering the fetch failed (only when executeClientScripts is true)
 * @returns {Promise} Promise object with `mimeType` and `content`
 */
export default async function fetch({ url, executeClientScripts, cssSelectors, options }) {
  if (executeClientScripts) {
    return fetchFullDom(url, cssSelectors, options);
  }

  return fetchHtmlOnly(url, options);
}
