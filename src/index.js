import dotenv from 'dotenv';
dotenv.config();

import consoleStamp from 'console-stamp';
consoleStamp(console);

import scrape from './scraper/index.js';
import { persistRaw, persistSanitized, pushChanges } from './history/index.js';
import sanitize from './sanitizer/index.js';
import getServiceProviders from './service_providers/index.js';
import { DOCUMENTS_TYPES } from './documents_types.js';

export async function updateServiceProviderDocument(serviceProviderId, serviceProviderName, documentType, documentUrl, documentContentSelector, sanitizationPipeline) {
  const logPrefix = `[${serviceProviderName}-${DOCUMENTS_TYPES[documentType].name}]`;

  console.log(`${logPrefix} Scrape '${documentUrl}'.`);
  const content = await scrape(documentUrl);

  const { sha: rawSha, filePath: rawFilePath} = await persistRaw(serviceProviderId, documentType, content);
  if (rawSha) {
    console.log(`${logPrefix} Save raw file to '${rawFilePath}'.`);
    console.log(`${logPrefix} Commit raw file in '${rawSha}'.`);
  } else {
    console.log(`${logPrefix} No raw changes, didn't commit.`);
  }

  const sanitizedContent = await sanitize(content, documentContentSelector, sanitizationPipeline);

  const { sha: sanitizedSha, filePath: sanitizedFilePath} = await persistSanitized(serviceProviderId, documentType, sanitizedContent);
  if (sanitizedSha) {
    console.log(`${logPrefix} Save sanitized file to '${sanitizedFilePath}'.`);
    console.log(`${logPrefix} Commit sanitized file in '${sanitizedSha}'.`);
  } else {
    console.log(`${logPrefix} No changes after sanitization, didn't commit.`);
  }
};

export default async function updateTerms() {
  console.log('Start scraping and saving terms of service…');

  const documentUpdatePromises = [];
  const serviceProvidersManifests = getServiceProviders();

  Object.keys(serviceProvidersManifests).forEach((serviceProviderId) => {
    const { documents, serviceProviderName } = serviceProvidersManifests[serviceProviderId];

    Object.keys(documents).forEach((documentType) => {
      const { url, contentSelector, sanitizationPipeline } = documents[documentType];
      documentUpdatePromises.push(updateServiceProviderDocument(serviceProviderId, serviceProviderName, documentType, url, contentSelector, sanitizationPipeline));
    });
  });

  await Promise.all(documentUpdatePromises);

  if (process.env.PRODUCTION) {
    await pushChanges();
    console.log('・・・・・・・');
    console.log('Pushed changes to the repository');
    console.log('______________________________');
  }
};
