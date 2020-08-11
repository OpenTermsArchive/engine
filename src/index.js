import fsApi from 'fs';
import path from 'path';
import events from 'events';

import config from 'config';

import consoleStamp from 'console-stamp';

import * as history from './history/index.js';
import fetch from './fetcher/index.js';
import filter from './filter/index.js';
import loadServiceDeclarations from './loader/index.js';

consoleStamp(console);

const fs = fsApi.promises;
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const SERVICE_DECLARATIONS_PATH = path.resolve(__dirname, '../', config.get('serviceDeclarationsPath'));

export default class CGUs extends events.EventEmitter {
  get serviceDeclarations() {
    return this._serviceDeclarations;
  }

  async init() {
    if (!this.initialized) {
      this._serviceDeclarations = await loadServiceDeclarations(SERVICE_DECLARATIONS_PATH);
      this.initialized = Promise.resolve();
    }

    return this.initialized;
  }

  async trackChanges(serviceToTrack) {
    try {
      console.log('Start tracking changes…');

      const services = serviceToTrack ? { [serviceToTrack]: this._serviceDeclarations[serviceToTrack] } : this._serviceDeclarations;

      const documentTrackingPromises = [];

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

      this.publish();
    } catch (error) {
      console.error(`Error when trying to track changes: ${error}`);
      this.emit('applicationError', error);
    }
  }

  async refilterAndRecordAll(serviceToTrack) {
    try {
      console.log('Refiltering documents…');

      const services = serviceToTrack ? { [serviceToTrack]: this._serviceDeclarations[serviceToTrack] } : this._serviceDeclarations;

      const regenerationPromises = [];

      Object.keys(services).forEach(serviceId => {
        const { documents, name: serviceName } = this._serviceDeclarations[serviceId];
        Object.keys(documents).forEach(type => {
          regenerationPromises.push(this.refilterAndRecord({
            serviceId,
            serviceName,
            document: {
              type,
              ...documents[type]
            }
          }));
        });
      });

      await Promise.all(regenerationPromises);
    } catch (error) {
      console.error(`Error when trying to refilter documents: ${error}`);
      this.emit('applicationError', error);
    }
  }

  async trackDocumentChanges({ serviceId, serviceName, document: documentDeclaration }) {
    const { type, fetch: location } = documentDeclaration;
    const logPrefix = `[${serviceName}-${type}]`;
    try {
      const pageContent = await this.fetch({
        location,
        serviceId,
        type,
        logPrefix,
      });

      if (!pageContent) {
        return;
      }

      const snapshotId = await this.recordSnapshot({
        snapshotContent: pageContent,
        content: pageContent,
        serviceId,
        type,
        logPrefix
      });

      if (!snapshotId) {
        return;
      }

      return this.recordVersion({
        snapshotContent: pageContent,
        snapshotId,
        serviceId,
        documentDeclaration,
        logPrefix,
      });
    } catch (error) {
      console.error(`${logPrefix} Error:`, error.message);
      this.emit('documentUpdateError', serviceId, type, error);
    }
  }

  async refilterAndRecord({ serviceId, serviceName, document: documentDeclaration }) {
    const { type } = documentDeclaration;
    const logPrefix = `[${serviceName}-${this._types[type].name}]`;
    try {
      const { id: snapshotId, path: snapshotPath } = await history.getLastSnapshot(serviceId, type);

      if (!snapshotId) {
        return;
      }

      const snapshotContent = await fs.readFile(snapshotPath, { encoding: 'utf8' });

      return this.recordRefilter({
        snapshotContent,
        snapshotId,
        serviceId,
        documentDeclaration,
        logPrefix,
      });
    } catch (error) {
      console.error(`${logPrefix} RefilterError:`, error.message);
    }
  }

  async fetch({ location, serviceId, type, logPrefix }) {
    console.log(`${logPrefix} Fetch '${location}'.`);
    try {
      return await fetch(location);
    } catch (error) {
      console.error(`${logPrefix} Could not fetch location: ${error}`);
      this.emit('documentFetchError', serviceId, type, error);
    }
  }

  async recordSnapshot({ content, serviceId, type, logPrefix }) {
    try {
      const { id: snapshotId, path: snapshotPath } = await history.recordSnapshot(serviceId, type, content);

      if (!snapshotId) {
        return console.log(`${logPrefix} No changes, did not record snapshot.`);
      }

      console.log(`${logPrefix} Recorded snapshot in ${snapshotPath} with id ${snapshotId}.`);
      return snapshotId;
    } catch (error) {
      console.error(`${logPrefix} RecordSnapshotError:`, error.message);
      this.emit('recordSnapshotError', serviceId, type, error);
    }
  }

  async recordRefilter({ snapshotContent, snapshotId, serviceId, documentDeclaration, logPrefix }) {
    const { type } = documentDeclaration;
    try {
      const document = await filter(snapshotContent, documentDeclaration, this._serviceDeclarations[serviceId].filters);

      const { id: versionId, path: documentPath } = await history.recordRefilter(serviceId, type, document, snapshotId);
      if (versionId) {
        console.log(`${logPrefix} Recorded version in ${documentPath} with id ${versionId}.`);
        this.emit('versionRecorded', serviceId, type, versionId);
      } else {
        console.log(`${logPrefix} No changes after filtering, did not record version.`);
      }
    } catch (error) {
      console.error(`${logPrefix} RecordVersionError:`, error.message);
      this.emit('recordVersionError', serviceId, type, error);
    }
  }

  async recordVersion({ snapshotContent, snapshotId, serviceId, documentDeclaration, logPrefix }) {
    const { type } = documentDeclaration;
    try {
      const document = await filter(snapshotContent, documentDeclaration, this._serviceDeclarations[serviceId].filters);

      const { id: versionId, path: documentPath, isFirstRecord } = await history.recordVersion(serviceId, type, document, snapshotId);
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
      console.error(`${logPrefix} RecordVersionError:`, error.message);
      this.emit('recordVersionError', serviceId, type, error);
    }
  }

  async publish() {
    if (!config.get('history.publish')) {
      return console.log('Publication disabled for this environment.');
    }

    try {
      await history.publish();
      console.log('Changes published');
      this.emit('changesPublished');
    } catch (error) {
      console.error(`Error when trying to publish changes: ${error}`);
      this.emit('publicationError', error);
    }
  }
}
