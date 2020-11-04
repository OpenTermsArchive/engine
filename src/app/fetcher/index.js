import fetchHtmlOnly from './htmlOnlyFetcher.js';
import fetchFullDom from './fullDomFetcher.js';

export default async function fetch({ url, executeClientScripts, cssSelectors }) {
  if (executeClientScripts) {
    return fetchFullDom(url, cssSelectors);
  }

  return fetchHtmlOnly(url);
}
