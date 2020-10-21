import nodeFetch from './nodeFetch.js';
import puppeteerFetch from './puppeteerFetch.js';

export default async function fetch(url, executeClientScripts, selector) {
  if (executeClientScripts) {
    return puppeteerFetch(url, selector);
  }

  return nodeFetch(url);
}
