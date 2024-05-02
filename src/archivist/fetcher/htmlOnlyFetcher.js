import convertBody from '@opentermsarchive/fetch-charset-detection'; // eslint-disable-line import/no-unresolved
import AbortController from 'abort-controller';
// https://github.com/node-fetch/fetch-charset-detection/issues/247
import HttpProxyAgent from 'http-proxy-agent';
import HttpsProxyAgent from 'https-proxy-agent';
import nodeFetch, { AbortError } from 'node-fetch';

export default async function fetch(url, configuration) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), configuration.navigationTimeout);

  const nodeFetchOptions = {
    signal: controller.signal,
    credentials: 'include',
    headers: { 'Accept-Language': configuration.language },
  };

  if (url.startsWith('https:') && process.env.HTTPS_PROXY) {
    nodeFetchOptions.agent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
  } else if (url.startsWith('http:') && process.env.HTTP_PROXY) {
    nodeFetchOptions.agent = new HttpProxyAgent(process.env.HTTP_PROXY);
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
    if (error instanceof AbortError) {
      throw new Error(`Timed out after ${configuration.navigationTimeout / 1000} seconds when trying to fetch '${url}'`);
    }

    throw new Error(error.message);
  } finally {
    clearTimeout(timeout);
  }
}
