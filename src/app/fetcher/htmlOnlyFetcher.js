import HttpProxyAgent from 'http-proxy-agent';
import HttpsProxyAgent from 'https-proxy-agent';
import https from 'https';
import nodeFetch from 'node-fetch';
import AbortController from 'abort-controller';

import { InaccessibleContentError } from '../errors.js';

const LANGUAGE = 'en';
const TIMEOUT = 5 * 60 * 1000; // 5 minutes in ms

export default async function fetch(url, { headers = {} } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  const options = {
    signal: controller.signal,
  };

  if (url.startsWith('https:') && process.env.HTTPS_PROXY) {
    options.agent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
  } else if (url.startsWith('http:') && process.env.HTTP_PROXY) {
    options.agent = new HttpProxyAgent(process.env.HTTP_PROXY);
  } else if (url.startsWith('https:')) {
    // Way to prevent reason: unable to verify the first certificate
    options.agent = https.Agent({
      rejectUnauthorized: false,
    });
  }

  options.credentials = 'include';
  options.headers = { 'Accept-Language': LANGUAGE, ...headers };

  let response;

  try {
    response = await nodeFetch(url, options);
  } catch (error) {
    handleErrors(error);
  } finally {
    clearTimeout(timeout);
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

function handleErrors(error) {
  if (
    error.code
    && error.code.match(/^(EAI_AGAIN|ENOTFOUND|ECONNRESET|CERT_HAS_EXPIRED|ERR_INVALID_PROTOCOL)$/)
  ) {
    throw new InaccessibleContentError(error.message);
  }

  if (error.name === 'AbortError') {
    throw new InaccessibleContentError(`The request timed out after ${TIMEOUT / 1000} seconds.`);
  }

  throw error;
}
