import path from 'path';
import events from 'events';

import config from 'config';

import consoleStamp from 'console-stamp';

import * as history from './history/index.js';
import fetch from './fetcher/index.js';
import filter from './filter/index.js';
import loadServiceDeclarations from './loader/index.js';

consoleStamp(console);

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
      console.log('\nStart tracking changes…');

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

      return this.publish();
    } catch (error) {
      console.error(`Error when trying to track changes: ${error}`);
      this.emit('applicationError', error);
    }
  }

  async trackDocumentChanges({ serviceId, serviceName, document: documentDeclaration }) {
    const { type, fetch: location } = documentDeclaration;
    const logPrefix = `[${serviceName}-${type}]`;
    try {
      const { mimeType, content } = await this.fetch({
        location,
        serviceId,
        type,
        logPrefix,
      });

      if (!content) {
        return;
      }

      const snapshotId = await this.recordSnapshot({
        content,
        mimeType,
        serviceId,
        type,
        logPrefix,
      });

      if (!snapshotId) {
        return;
      }

      return this.recordVersion({
        snapshotContent: content,
        mimeType,
        snapshotId,
        serviceId,
        documentDeclaration,
        logPrefix,
      });
    } catch (error) {
      console.error(`${logPrefix} Error:`, error);
      this.emit('documentUpdateError', serviceId, type, error);
    }
  }

  async refilterAndRecord(serviceToTrack) {
    console.log('\nRefiltering documents… (it could take a while)');

    const services = serviceToTrack ? { [serviceToTrack]: this._serviceDeclarations[serviceToTrack] } : this._serviceDeclarations;

    const refilterAndRecordDocumentPromises = [];

    Object.keys(services).forEach(serviceId => {
      const { documents, name: serviceName } = this._serviceDeclarations[serviceId];
      Object.keys(documents).forEach(type => {
        refilterAndRecordDocumentPromises.push(this.refilterAndRecordDocument({
          serviceId,
          serviceName,
          document: {
            type,
            ...documents[type]
          }
        }));
      });
    });

    return Promise.all(refilterAndRecordDocumentPromises);
  }

  async refilterAndRecordDocument({ serviceId, serviceName, document: documentDeclaration }) {
    const { type } = documentDeclaration;
    const logPrefix = `[${serviceName}-${type}]`;
    try {
      const { id: snapshotId, content: snapshotContent, mimeType } = await history.getLatestSnapshot(serviceId, type);

      if (!snapshotId) {
        return;
      }

      return await this.recordRefilter({
        snapshotContent,
        mimeType,
        snapshotId,
        serviceId,
        documentDeclaration,
        logPrefix,
      });
    } catch (error) {
      console.error(`${logPrefix} Could not refilter document: ${error}`);
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

  /* eslint-disable class-methods-use-this */
  async recordSnapshot({ content, mimeType, serviceId, type, logPrefix }) {
    const { id: snapshotId, path: snapshotPath } = await history.recordSnapshot({
      serviceId,
      documentType: type,
      content,
      mimeType
    });

    if (!snapshotId) {
      return console.log(`${logPrefix} No changes, did not record snapshot.`);
    }

    console.log(`${logPrefix} Recorded snapshot in ${snapshotPath} with id ${snapshotId}.`);
    return snapshotId;
  }
  /* eslint-enable class-methods-use-this */

  async recordRefilter({ snapshotContent, mimeType, snapshotId, serviceId, documentDeclaration, logPrefix }) {
    const { type } = documentDeclaration;
    const document = await filter({
      content: snapshotContent,
      mimeType,
      documentDeclaration,
      filterFunctions: this._serviceDeclarations[serviceId].filters
    });

    const { id: versionId, path: documentPath } = await history.recordRefilter({
      serviceId,
      content: document,
      documentType: type,
      snapshotId
    });

    if (versionId) {
      console.log(`${logPrefix} Recorded version in ${documentPath} with id ${versionId}.`);
      this.emit('versionRecorded', serviceId, type, versionId);
    } else {
      console.log(`${logPrefix} No changes after filtering, did not record version.`);
    }
  }

  async recordVersion({ snapshotContent, mimeType, snapshotId, serviceId, documentDeclaration, logPrefix }) {
    const { type } = documentDeclaration;
    const document = await filter({
      content: snapshotContent,
      mimeType,
      documentDeclaration,
      filterFunctions: this._serviceDeclarations[serviceId].filters,
    });

    const { id: versionId, path: documentPath, isFirstRecord } = await history.recordVersion({
      serviceId,
      content: document,
      documentType: type,
      snapshotId
    });

    if (versionId) {
      const message = isFirstRecord
        ? `${logPrefix} First version recorded in ${documentPath} with id ${versionId}.`
        : `${logPrefix} Recorded version in ${documentPath} with id ${versionId}.`;
      console.log(message);
      this.emit(isFirstRecord ? 'documentAdded' : 'versionRecorded', serviceId, type, versionId);
    } else {
      console.log(`${logPrefix} No changes after filtering, did not record version.`);
    }
  }

  async publish() {
    if (!config.get('history.publish')) {
      return;
    }

    await history.publish();
    console.log('Changes published');
    this.emit('changesPublished');
  }
}
