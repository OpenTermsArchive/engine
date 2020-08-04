import path from 'path';
import events from 'events';

import config from 'config';

import consoleStamp from 'console-stamp';

import { publish, recordSnapshot, recordVersion } from './history/index.js';
import fetch from './fetcher/index.js';
import filter from './filter/index.js';
import loadServiceDeclarations from './loader/index.js';
import { TYPES } from './types.js';

consoleStamp(console);

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const SERVICE_DECLARATIONS_PATH = path.resolve(__dirname, '../', config.get('serviceDeclarationsPath'));

export default class CGUs extends events.EventEmitter {
  constructor() {
    super();
    this._types = TYPES;
  }

  get serviceDeclarations() {
    return this._serviceDeclarations;
  }

  get documentTypes() {
    return this._types;
  }

  async init() {
    if (!this.initialized) {
      this._serviceDeclarations = await loadServiceDeclarations(SERVICE_DECLARATIONS_PATH);
      this.initialized = Promise.resolve();
    }

    return this.initialized;
  }

  async trackChanges(serviceToTrack) {
    console.log('Start scraping and saving terms of service…');

    const documentTrackingPromises = [];

    const services = serviceToTrack ? { [serviceToTrack]: this._serviceDeclarations[serviceToTrack] } : this._serviceDeclarations;

    Object.keys(services).forEach(serviceId => {
      const { documents, name: serviceName } = this._serviceDeclarations[serviceId];

      Object.keys(documents).forEach(type => {
        documentTrackingPromises.push(this.trackDocumentChanges({
          serviceId,
          serviceName,
          document: {
            type,
            ...documents[type]
          }
        }));
      });
    });

    await Promise.all(documentTrackingPromises);

    if (config.get('history.publish')) {
      await publish();
      console.log('Published changes');
    }
  }

  async trackDocumentChanges({ serviceId, serviceName, document }) {
    const { type, location, contentSelector, filters } = document;
    const logPrefix = `[${serviceName}-${this._types[type].name}]`;
    try {
      console.log(`${logPrefix} Fetch '${location}'.`);
      let pageContent;
      try {
        pageContent = await fetch(location);
      } catch (error) {
        console.error(`${logPrefix} Could not fetch location: ${error}`);
        return this.emit('fetchingError', serviceId, type, error);
      }

      const { id: snapshotId, path: snapshotPath } = await recordSnapshot(serviceId, type, pageContent);

      console.log(`${logPrefix} Fetched web page to ${snapshotPath}.`);

      if (!snapshotId) {
        return console.log(`${logPrefix} No changes, did not record snapshot.`);
      }

      console.log(`${logPrefix} Recorded snapshot with id ${snapshotId}.`);

      const document = await filter(pageContent, contentSelector, location, filters, this._serviceDeclarations[serviceId].filters);

      const { id: versionId, path: documentPath, isFirstRecord } = await recordVersion(serviceId, type, document, snapshotId);
      if (versionId) {
        const message = isFirstRecord
          ? `${logPrefix} First version recorded in ${documentPath} with id ${versionId}.`
          : `${logPrefix} Recorded version in ${documentPath} with id ${versionId}.`;
        console.log(message);
        this.emit(isFirstRecord ? 'documentAdded' : 'versionRecorded', serviceId, type, versionId);
      } else {
        console.log(`${logPrefix} No changes after filtering, did not record version.`);
      }
    } catch (error) {
      console.error(`${logPrefix} Error:`, error);
      this.emit('error', serviceId, type, error);
    }
  }
}
