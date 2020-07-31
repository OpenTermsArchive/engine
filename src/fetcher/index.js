import fs from 'fs';

import nodeFetch from 'node-fetch';
import HttpProxyAgent from 'http-proxy-agent';
import HttpsProxyAgent from 'https-proxy-agent';
import pdf2html from 'pdf2html';

import { recordPDFSnapshot } from '../history/index.js';

const LANGUAGE = 'en'

export default async function fetch(url, recorderParams) {
  const options = {};
  if (url.startsWith('https:') && process.env.HTTPS_PROXY) {
    options.agent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
  }
  else if (url.startsWith('http:') && process.env.HTTP_PROXY) {
    options.agent = new HttpProxyAgent(process.env.HTTP_PROXY);
  }
  options.headers = {'Accept-Language': LANGUAGE}

  const response = await nodeFetch(url, options);

  if (!response.ok) {
    throw new Error(`Received HTTP code ${response.status} when trying to fetch '${url}'`);
  }

  const blob = await response.blob();

  if (blob.type.startsWith('text/')) {
    return blob.text();
  } else if (blob.type.startsWith('application/pdf') && recorderParams) {
    const recordDetails = await recordPDFSnapshot(
      recorderParams.serviceId,
      recorderParams.documentType,
      Buffer.from(await blob.arrayBuffer())
    );
    const pdf2htmlPromise = new Promise(resolve => {
      pdf2html.html(recordDetails.path, (err, html) => {
        if (err) {
          throw new Error(`PDF conversion error: ${err}.`)
        } else {
          resolve(html);
        }
      });
    });
    return pdf2htmlPromise;
  } else {
    return blob;
  }
}
