import path from 'path';
import events from 'events';

import config from 'config';

import * as history from './history/index.js';
import fetch from './fetcher/index.js';
import filter from './filter/index.js';
import loadServiceDeclarations from './loader/index.js';
import { InaccessibleContentError } from './errors.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const SERVICE_DECLARATIONS_PATH = path.resolve(__dirname, '../../', config.get('serviceDeclarationsPath'));

export const AVAILABLE_EVENTS = {
  snapshotRecorded: 'snapshotRecorded',
  firstSnapshotRecorded: 'firstSnapshotRecorded',
  snapshotNotChanged: 'snapshotNotChanged',
  versionRecorded: 'versionRecorded',
  firstVersionRecorded: 'firstVersionRecorded',
  versionNotChanged: 'versionNotChanged',
  recordsPublished: 'recordsPublished',
  inaccessibleContentError: 'inaccessibleContentError',
  refilteringError: 'refilteringError',
};

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
    Object.keys(AVAILABLE_EVENTS).forEach(eventId => {
      const event = AVAILABLE_EVENTS[eventId];
      const handlerName = `on${event[0].toUpperCase()}${event.substr(1)}`;

      if (listener[handlerName]) {
        this.on(event, listener[handlerName].bind(listener));
      }
    });
  }

  async trackChanges(servicesSubset) {
    await this.forEachDocumentOfServices(servicesSubset, serviceDocument => this.trackDocumentChanges(serviceDocument));

    await this.publish();
  }

  async trackDocumentChanges({ serviceId, document: documentDeclaration }) {
    const { type, fetch: location } = documentDeclaration;

    const { mimeType, content } = await fetch(location);

    if (!content) {
      return;
    }

    const snapshotId = await this.recordSnapshot({
      content,
      mimeType,
      serviceId,
      type
    });

    if (!snapshotId) {
      return;
    }

    await this.recordVersion({
      snapshotContent: content,
      mimeType,
      snapshotId,
      serviceId,
      documentDeclaration
    });
  }

  async refilterAndRecord(servicesSubset) {
    return this.forEachDocumentOfServices(servicesSubset, serviceDocument => this.refilterAndRecordDocument(serviceDocument));
  }

  async refilterAndRecordDocument({ serviceId, document: documentDeclaration }) {
    const { type } = documentDeclaration;

    const { id: snapshotId, content: snapshotContent, mimeType } = await history.getLatestSnapshot(serviceId, type);

    if (!snapshotId) {
      return;
    }

    return this.recordRefilter({
      snapshotContent,
      mimeType,
      snapshotId,
      serviceId,
      documentDeclaration,
    });
  }

  async forEachDocumentOfServices(servicesSubset = [], callback) {
    let services = this._serviceDeclarations;

    if (servicesSubset.length) {
      services = servicesSubset.reduce((accumulator, service) => {
        accumulator[service] = this._serviceDeclarations[service];
        return accumulator;
      }, {});
    }

    let documentPromises = [];

    Object.keys(services).forEach(serviceId => {
      const { documents } = this._serviceDeclarations[serviceId];
      const documentsPromises = Object.keys(documents).map(async type => {
        try {
          await callback({
            serviceId,
            document: {
              type,
              ...documents[type]
            }
          });
        } catch (error) {
          if (error instanceof InaccessibleContentError) {
            return this.emit(AVAILABLE_EVENTS.inaccessibleContentError, serviceId, type, error);
          }
          throw error;
        }
      });

      documentPromises = documentPromises.concat(documentsPromises);
    });

    await Promise.all(documentPromises);
  }

  async recordSnapshot({ content, mimeType, serviceId, type }) {
    const { id: snapshotId, isFirstRecord } = await history.recordSnapshot({
      serviceId,
      documentType: type,
      content,
      mimeType
    });

    if (!snapshotId) {
      return this.emit(AVAILABLE_EVENTS.snapshotNotChanged, serviceId, type);
    }

    this.emit(isFirstRecord ? AVAILABLE_EVENTS.firstSnapshotRecorded : AVAILABLE_EVENTS.snapshotRecorded, serviceId, type, snapshotId);
    return snapshotId;
  }

  async recordRefilter({ snapshotContent, mimeType, snapshotId, serviceId, documentDeclaration }) {
    const { type } = documentDeclaration;
    const document = await filter({
      content: snapshotContent,
      mimeType,
      documentDeclaration,
      filterFunctions: this._serviceDeclarations[serviceId].filters
    });

    const { id: versionId, isFirstRecord } = await history.recordRefilter({
      serviceId,
      content: document,
      documentType: type,
      snapshotId
    });

    if (!versionId) {
      return this.emit(AVAILABLE_EVENTS.versionNotChanged, serviceId, type);
    }

    this.emit(isFirstRecord ? AVAILABLE_EVENTS.firstVersionRecorded : AVAILABLE_EVENTS.versionRecorded, serviceId, type, versionId);
  }

  async recordVersion({ snapshotContent, mimeType, snapshotId, serviceId, documentDeclaration }) {
    const { type } = documentDeclaration;
    const document = await filter({
      content: snapshotContent,
      mimeType,
      documentDeclaration,
      filterFunctions: this._serviceDeclarations[serviceId].filters,
    });

    const { id: versionId, isFirstRecord } = await history.recordVersion({
      serviceId,
      content: document,
      documentType: type,
      snapshotId
    });

    if (!versionId) {
      return this.emit(AVAILABLE_EVENTS.versionNotChanged, serviceId, type);
    }

    this.emit(isFirstRecord ? AVAILABLE_EVENTS.firstVersionRecorded : AVAILABLE_EVENTS.versionRecorded, serviceId, type, versionId);
  }

  async publish() {
    if (!config.get('history.publish')) {
      return;
    }

    await history.publish();
    this.emit(AVAILABLE_EVENTS.recordsPublished);
  }
}
