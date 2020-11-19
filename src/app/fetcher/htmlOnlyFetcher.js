import nodeFetch from 'node-fetch';
import HttpProxyAgent from 'http-proxy-agent';
import HttpsProxyAgent from 'https-proxy-agent';

import { InaccessibleContentError } from '../errors.js';

const LANGUAGE = 'en';

export default async function fetch(url) {
  const options = {};

  if (url.startsWith('https:') && process.env.HTTPS_PROXY) {
    options.agent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
  } else if (url.startsWith('http:') && process.env.HTTP_PROXY) {
    options.agent = new HttpProxyAgent(process.env.HTTP_PROXY);
  }
  options.headers = { 'Accept-Language': LANGUAGE };

  let response;
  try {
    response = await nodeFetch(url, options);
  } catch (error) {
    if (error.code && error.code.match(/^(ENOTFOUND|ETIMEDOUT|ECONNRESET)$/)) {
      throw new InaccessibleContentError(error.message);
    }
    throw error;
  }

  if (!response.ok) {
    throw new InaccessibleContentError(`Received HTTP code ${response.status} when trying to fetch '${url}'`);
  }

  const mimeType = response.headers.get('content-type');

  return {
    mimeType,
    content: await (mimeType.startsWith('text/') ? response.text() : response.buffer()),
  };
}
