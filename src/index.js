import dotenv from 'dotenv';
dotenv.config();

import consoleStamp from 'console-stamp';
consoleStamp(console);

import scrape from './scraper/index.js';
import { persistRaw, persistSanitized } from './history/index.js';
import sanitize from './sanitizer/index.js';
import serviceProviders from './service_providers/index.js';

export async function updateServiceProviderDocument(serviceProviderId, documentType, documentUrl, documentContentSelector) {
  const content = await scrape(documentUrl);
  await persistRaw(serviceProviderId, documentType, content);
  const sanitizedContent = await sanitize(content, documentContentSelector);
  await persistSanitized(serviceProviderId, documentType, sanitizedContent);
};

export default async function updateTerms() {
  console.log('Start scraping and saving terms of service…');

  const promises = [];
  const serviceProvidersManifests = serviceProviders();

  Object.keys(serviceProvidersManifests).forEach((serviceProviderId) => {
    const { documents } = serviceProvidersManifests[serviceProviderId];

    Object.keys(documents).forEach(async (documentType) => {
      const { url, contentSelector } = documents[documentType];
      promises.push(updateServiceProviderDocument(serviceProviderId, documentType, url, contentSelector));
    });
  });

  return Promise.all(promises);
};
