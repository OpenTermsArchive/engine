import fetchFullDom from './fullDomFetcher.js';
import fetchHtmlOnly from './htmlOnlyFetcher.js';

export default async function fetch({ url, executeClientScripts, cssSelectors, headers }) {
  if (executeClientScripts) {
    return fetchFullDom(url, cssSelectors, headers);
  }

  return fetchHtmlOnly(url, { headers });
}
