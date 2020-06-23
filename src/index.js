import dotenv from 'dotenv';
dotenv.config();

import consoleStamp from 'console-stamp';
consoleStamp(console);

import scrape from './scraper/index.js';
import { persistRaw, persistSanitized, pushChanges } from './history/index.js';
import sanitize from './sanitizer/index.js';
import getServiceProviders from './service_providers/index.js';
import { DOCUMENTS_TYPES } from './documents_types.js';
import * as notifier from './notifier/index.js';

export async function updateServiceProviderDocument(serviceProviderId, serviceProviderName, documentType, documentUrl, documentContentSelector) {
  const logPrefix = `[${serviceProviderName}-${DOCUMENTS_TYPES[documentType].name}]`;

  console.log(`${logPrefix} Scrape '${documentUrl}'.`);
  let content;
  try {
    content = await scrape(documentUrl);
  } catch (error) {
    console.error(`${logPrefix} Can't scrape url: ${error}`);
    return notifier.onDocumentScrapingError(serviceProviderId, documentType, e);
  }

  const { sha: rawSha, filePath: rawFilePath} = await persistRaw(serviceProviderId, documentType, content);

  console.log(`${logPrefix} Save raw file to '${rawFilePath}'.`);

  if (!rawSha) {
    return console.log(`${logPrefix} No raw changes, didn't commit.`);
  }

  console.log(`${logPrefix} Commit raw file in '${rawSha}'.`);

  const sanitizedContent = await sanitize(content, documentContentSelector);

  const { sha: sanitizedSha, filePath: sanitizedFilePath} = await persistSanitized(serviceProviderId, documentType, sanitizedContent, rawSha);
  if (sanitizedSha) {
    console.log(`${logPrefix} Save sanitized file to '${sanitizedFilePath}'.`);
    console.log(`${logPrefix} Commit sanitized file in '${sanitizedSha}'.`);
    await notifier.onSanitizedDocumentChange(serviceProviderId, documentType, sanitizedSha);
  } else {
    console.log(`${logPrefix} No changes after sanitization, didn't commit.`);
  }
};

export default async function updateTerms() {
  await init();

  console.log('Start scraping and saving terms of service…');

  const documentUpdatePromises = [];

  const serviceProvidersManifests = getServiceProviders();
  Object.keys(serviceProvidersManifests).forEach((serviceProviderId) => {
    const { documents, serviceProviderName } = serviceProvidersManifests[serviceProviderId];

    Object.keys(documents).forEach((documentType) => {
      const { url, contentSelector } = documents[documentType];
      documentUpdatePromises.push(updateServiceProviderDocument(serviceProviderId, serviceProviderName, documentType, url, contentSelector));
    });
  });

  await Promise.all(documentUpdatePromises);

  if (process.env.NODE_ENV === 'production') {
    await pushChanges();
    console.log('・・・・・・・');
    console.log('Pushed changes to the repository');
    console.log('______________________________');
  }
};

let initialized;
async function init() {
  if (!initialized) {
    const serviceProvidersManifests = getServiceProviders();
    return Promise.all([notifier.init(serviceProvidersManifests, DOCUMENTS_TYPES)]).then(() => {
      initialized = Promise.resolve();
    });
  }

  return initialized;
}
