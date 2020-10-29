import serverFetch from './serverFetch/index.js';
import clientFetch from './clientFetch/index.js';

export default async function fetch({ url, executeClientScripts, cssSelectors }) {
  if (executeClientScripts) {
    return clientFetch(url, cssSelectors);
  }

  return serverFetch(url);
}
