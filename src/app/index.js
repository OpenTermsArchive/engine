import fsApi from 'fs';
import path from 'path';
import events from 'events';

import config from 'config';

import * as history from './history/index.js';
import fetch from './fetcher/index.js';
import filter from './filter/index.js';
import loadServiceDeclarations from './loader/index.js';

const fs = fsApi.promises;
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const SERVICE_DECLARATIONS_PATH = path.resolve(__dirname, '../../', config.get('serviceDeclarationsPath'));

const AVAILABLE_EVENTS = [
  'startTrackingChanges',
  'endTrackingChanges',
  'startRefiltering',
  'endRefiltering',
  'snapshotRecorded',
  'firstSnapshotRecorded',
  'noSnapshotChanges',
  'versionRecorded',
  'firstVersionRecorded',
  'noVersionChanges',
  'changesPublished',
  'applicationError',
  'documentUpdateError',
  'documentFetchError',
  'recordRefilterError',
];

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

  attach(listener) {
    AVAILABLE_EVENTS.forEach(event => {
      const handlerName = `on${event[0].toUpperCase()}${event.substr(1)}`;

      if (Object.prototype.hasOwnProperty.call(listener, handlerName)
      || Object.prototype.hasOwnProperty.call(listener.constructor.prototype, handlerName)) {
        this.on(event, listener[handlerName].bind(listener));
      }
    });
  }

  async trackChanges(serviceToTrack) {
    try {
      this.emit('startTrackingChanges');

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

      await this.publish();
      this.emit('endTrackingChanges');
    } catch (error) {
      this.emit('applicationError', error);
    }
  }

  async trackDocumentChanges({ serviceId, document: documentDeclaration }) {
    const { type, fetch: location } = documentDeclaration;

    try {
      const pageContent = await this.fetch({
        location,
        serviceId,
        type,
      });

      if (!pageContent) {
        return;
      }

      const snapshotId = await this.recordSnapshot({
        snapshotContent: pageContent,
        content: pageContent,
        serviceId,
        type
      });

      if (!snapshotId) {
        return;
      }

      return this.recordVersion({
        snapshotContent: pageContent,
        snapshotId,
        serviceId,
        documentDeclaration
      });
    } catch (error) {
      this.emit('documentUpdateError', serviceId, type, error);
    }
  }

  async refilterAndRecord(serviceToTrack) {
    this.emit('startRefiltering');
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

    await Promise.all(refilterAndRecordDocumentPromises);
    this.emit('endRefiltering');
  }

  async refilterAndRecordDocument({ serviceId, serviceName, document: documentDeclaration }) {
    const { type } = documentDeclaration;
    const logPrefix = `[${serviceName}-${type}]`;
    const { id: snapshotId, path: snapshotPath } = await history.getLatestSnapshot(serviceId, type);

    if (!snapshotId) {
      return;
    }

    let snapshotContent;
    try {
      snapshotContent = await fs.readFile(snapshotPath, { encoding: 'utf8' });
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`The snapshot file ${snapshotPath} does not exist.`);
      }
    }

    return this.recordRefilter({
      snapshotContent,
      snapshotId,
      serviceId,
      documentDeclaration,
      logPrefix,
    });
  }

  async fetch({ location, serviceId, type }) {
    try {
      return await fetch(location);
    } catch (error) {
      this.emit('documentFetchError', serviceId, type, error);
    }
  }

  async recordSnapshot({ content, serviceId, type }) {
    const { id: snapshotId, isFirstRecord } = await history.recordSnapshot(serviceId, type, content);

    if (!snapshotId) {
      return this.emit('noSnapshotChanges', serviceId, type);
    }

    this.emit(isFirstRecord ? 'firstSnapshotRecorded' : 'snapshotRecorded', serviceId, type, snapshotId);
    return snapshotId;
  }

  async recordRefilter({ snapshotContent, snapshotId, serviceId, documentDeclaration }) {
    const { type } = documentDeclaration;
    try {
      const document = await filter(snapshotContent, documentDeclaration, this._serviceDeclarations[serviceId].filters);

      const { id: versionId, isFirstRecord } = await history.recordRefilter(serviceId, type, document, snapshotId);

      if (!versionId) {
        return this.emit('noVersionChanges', serviceId, type);
      }

      this.emit(isFirstRecord ? 'firstVersionRecorded' : 'versionRecorded', serviceId, type, versionId);
    } catch (error) {
      this.emit('recordRefilterError', serviceId, type, error);
    }
  }

  async recordVersion({ snapshotContent, snapshotId, serviceId, documentDeclaration }) {
    const { type } = documentDeclaration;
    const document = await filter(snapshotContent, documentDeclaration, this._serviceDeclarations[serviceId].filters);

    const { id: versionId, isFirstRecord } = await history.recordVersion(serviceId, type, document, snapshotId);

    if (!versionId) {
      return this.emit('noVersionChanges', serviceId, type);
    }

    this.emit(isFirstRecord ? 'firstVersionRecorded' : 'versionRecorded', serviceId, type, versionId);
  }

  async publish() {
    if (!config.get('history.publish')) {
      return;
    }

    await history.publish();
    this.emit('changesPublished');
  }
}
