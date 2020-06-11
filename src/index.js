import dotenv from 'dotenv';
dotenv.config();

import consoleStamp from 'console-stamp';
consoleStamp(console);

import scrape from './scraper/index.js';
import { persistRaw, persistSanitized } from './history/index.js';
import sanitize from './sanitizer/index.js';
import serviceProviders from './service_providers/index.js';

export async function updateServiceProviderDocument(serviceProviderId, serviceProviderName, documentType, documentUrl, documentContentSelector) {
  console.log(`${serviceProviderName}: Scrape '${documentUrl}'.`);
  const content = await scrape(documentUrl);

  console.log(`${serviceProviderName}: Persist raw document '${documentType}'.`);
  await persistRaw(serviceProviderId, documentType, content);

  console.log(`${serviceProviderName}: Sanitize raw document '${documentType}'.`);
  const sanitizedContent = await sanitize(content, documentContentSelector);

  console.log(`${serviceProviderName}: Persist sanitized document '${documentType}'.`);
  await persistSanitized(serviceProviderId, documentType, sanitizedContent);
};

export default async function updateTerms() {
  console.log('Start scraping and saving terms of service…');

  const promises = [];
  const serviceProvidersManifests = serviceProviders();

  Object.keys(serviceProvidersManifests).forEach((serviceProviderId) => {
    const { documents, serviceProviderName } = serviceProvidersManifests[serviceProviderId];

    Object.keys(documents).forEach(async (documentType) => {
      const { url, contentSelector } = documents[documentType];
      promises.push(updateServiceProviderDocument(serviceProviderId, serviceProviderName, documentType, url, contentSelector));
    });
  });

  return Promise.all(promises);
};
