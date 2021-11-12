import { InaccessibleContentError } from '../errors.js';

import { ErrorCodes } from './errors.js';
import fetchFullDom from './fullDomFetcher.js';
import fetchHtmlOnly from './htmlOnlyFetcher.js';

export { launchHeadlessBrowser, stopHeadlessBrowser } from './fullDomFetcher.js';

export default async function fetch({ url, executeClientScripts, cssSelectors }) {
  try {
    if (executeClientScripts) {
      return await fetchFullDom(url, cssSelectors);
    }

    return await fetchHtmlOnly(url);
  } catch (error) {
    if (ErrorCodes.includes(error.code) || ErrorCodes.some(message => error.message?.includes(message))) { // Depending on the fetcher used, the error code is found either in error.code or error.message
      throw new InaccessibleContentError(error.message);
    }

    throw error;
  }
}
