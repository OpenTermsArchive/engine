import fetchFullDom from './fullDomFetcher.js';
import fetchHtmlOnly from './htmlOnlyFetcher.js';

export default async function fetch({ url, executeClientScripts, cssSelectors }) {
  if (executeClientScripts) {
    return fetchFullDom(url, cssSelectors);
  }

  return fetchHtmlOnly(url);
}
