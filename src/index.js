import path from 'path';
import events from 'events';

import config from 'config';

import consoleStamp from 'console-stamp';
consoleStamp(console);

import scrape from './scraper/index.js';
import { persistRaw, persistSanitized, pushChanges } from './history/index.js';
import sanitize from './sanitizer/index.js';
import loadServiceProviders from './service_providers/index.js';
import { DOCUMENTS_TYPES } from './documents_types.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const SERVICE_PROVIDERS_PATH = path.resolve(__dirname, '../', config.get('serviceProvidersPath'));

export default class CGUs extends events.EventEmitter {
  constructor() {
    super();
    this.documentTypes = DOCUMENTS_TYPES;
  }

  get serviceProviders() {
    return this.serviceProvidersManifests;
  }

  get documentsTypes() {
    return this.documentTypes;
  }

  async init() {
    if (!this.initialized) {
      this.serviceProvidersManifests = await loadServiceProviders(SERVICE_PROVIDERS_PATH);
      this.initialized = Promise.resolve();
    }

    return this.initialized;
  }

  async updateTerms() {
    console.log('Start scraping and saving terms of service…');

    const documentUpdatePromises = [];

    Object.keys(this.serviceProvidersManifests).forEach((serviceProviderId) => {
      const { documents, serviceProviderName } = this.serviceProvidersManifests[serviceProviderId];

      Object.keys(documents).forEach((documentType) => {
        documentUpdatePromises.push(this.updateServiceProviderDocument({
          serviceProviderId,
          serviceProviderName,
          document: {
            documentType,
            ...documents[documentType]
          }
        }));
      });
    });

    await Promise.all(documentUpdatePromises);

    if (config.get('history.exportChanges')) {
      await pushChanges();
      console.log('・・・・・・・');
      console.log('Pushed changes to the repository');
      console.log('______________________________');
    }
  }

  async updateServiceProviderDocument({ serviceProviderId, serviceProviderName, document }) {
    const { documentType, url, contentSelector, sanitizationPipeline } = document;
    const logPrefix = `[${serviceProviderName}-${DOCUMENTS_TYPES[documentType].name}]`;
    try {
      console.log(`${logPrefix} Scrape '${url}'.`);
      let content;
      try {
        content = await scrape(url);
      } catch (error) {
        console.error(`${logPrefix} Can't scrape url: ${error}`);
        return this.emit('documentScrapingError', serviceProviderId, documentType, error);
      }

      const { sha: rawSha, filePath: rawFilePath} = await persistRaw(serviceProviderId, documentType, content);

      console.log(`${logPrefix} Save raw file to '${rawFilePath}'.`);

      if (!rawSha) {
        return console.log(`${logPrefix} No raw changes, didn't commit.`);
      }

      console.log(`${logPrefix} Commit raw file in '${rawSha}'.`);

      const sanitizedContent = await sanitize(content, contentSelector, sanitizationPipeline, this.serviceProvidersManifests[serviceProviderId].sanitizers);

      const { sha: sanitizedSha, filePath: sanitizedFilePath} = await persistSanitized(serviceProviderId, documentType, sanitizedContent, rawSha);
      if (sanitizedSha) {
        console.log(`${logPrefix} Save sanitized file to '${sanitizedFilePath}'.`);
        console.log(`${logPrefix} Commit sanitized file in '${sanitizedSha}'.`);
        this.emit('sanitizedDocumentChange', serviceProviderId, documentType, sanitizedSha);
      } else {
        console.log(`${logPrefix} No changes after sanitization, didn't commit.`);
      }
    } catch (error) {
      console.error(`${logPrefix} Error:`, error);
      this.emit('applicationError', serviceProviderId, documentType, error);
    }
  }
}
