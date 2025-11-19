import AbortController from 'abort-controller';
import convertBody from 'fetch-charset-detection'; // eslint-disable-line import/no-unresolved
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import nodeFetch, { AbortError } from 'node-fetch';

import { resolveProxyConfiguration } from './proxyUtils.js';

export default async function fetch(url, config) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.navigationTimeout);

  const nodeFetchOptions = {
    signal: controller.signal,
    credentials: 'include',
    headers: { 'Accept-Language': config.language },
  };

  const { httpProxy, httpsProxy } = resolveProxyConfiguration();

  if (url.startsWith('https:') && httpsProxy) {
    nodeFetchOptions.agent = new HttpsProxyAgent(httpsProxy);
  } else if (url.startsWith('http:') && httpProxy) {
    nodeFetchOptions.agent = new HttpProxyAgent(httpProxy);
  }

  let response;

  try {
    response = await nodeFetch(url, nodeFetchOptions);

    if (!response.ok) {
      throw new Error(`Received HTTP code ${response.status} when trying to fetch '${url}'`);
    }

    const mimeType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const responseBuffer = await response.arrayBuffer();
    let content;

    if (mimeType.startsWith('text/')) {
      content = convertBody(responseBuffer, response.headers);
    } else {
      content = Buffer.from(responseBuffer);
    }

    if (contentLength == 0 || !content) {
      throw new Error(`Received an empty content when fetching '${url}'`);
    }

    return {
      mimeType,
      content,
    };
  } catch (error) {
    if (error.type == 'system') { // Node-fetch wraps system-level errors (ENOTFOUND, ECONNREFUSED, ECONNRESET, etc.) with type 'system' and includes the original error code
      throw new Error(`Network system error ${error.code} occurred when trying to fetch '${url}'`);
    }

    if (error instanceof AbortError) {
      throw new Error(`Timed out after ${config.navigationTimeout / 1000} seconds when trying to fetch '${url}'`);
    }

    throw new Error(error.message);
  } finally {
    clearTimeout(timeout);
  }
}
