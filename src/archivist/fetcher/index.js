import fetchFullDom from './fullDomFetcher.js';
import fetchHtmlOnly from './htmlOnlyFetcher.js';

export { launchHeadlessBrowser, stopHeadlessBrowser } from './fullDomFetcher.js';
export { FetchDocumentError } from './errors.js';

export default async function fetch({ url, executeClientScripts, cssSelectors, options }) {
  if (executeClientScripts) {
    return fetchFullDom(url, cssSelectors, options);
  }

  return fetchHtmlOnly(url, options);
}
