import path from 'path';
import events from 'events';

import config from 'config';
import async from 'async';

import * as history from './history/index.js';
import fetch from './fetcher/index.js';
import filter from './filter/index.js';
import loadServiceDeclarations from './loader/index.js';
import { InaccessibleContentError } from './errors.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const SERVICE_DECLARATIONS_PATH = path.resolve(__dirname, '../../', config.get('serviceDeclarationsPath'));
const NUMBER_OF_TRACK_DOCUMENT_WORKERS = 20;
const NUMBER_OF_REFILTER_WORKERS = 1;

export const AVAILABLE_EVENTS = [
  'snapshotRecorded',
  'firstSnapshotRecorded',
  'snapshotNotChanged',
  'versionRecorded',
  'firstVersionRecorded',
  'versionNotChanged',
  'recordsPublished',
  'inaccessibleContent',
  'error'
];

export default class CGUs extends events.EventEmitter {
  get serviceDeclarations() {
    return this._serviceDeclarations;
  }

  get serviceIds() {
    return Object.keys(this._serviceDeclarations);
  }

  async init() {
    if (!this._serviceDeclarations) {
      this.trackDocumentChangesQueue = async.queue(async ({ serviceDocument }) => this.trackDocumentChanges(serviceDocument), NUMBER_OF_TRACK_DOCUMENT_WORKERS);
      this.refilterDocumentsQueue = async.queue(async ({ serviceDocument }) => this.refilterAndRecordDocument(serviceDocument), NUMBER_OF_REFILTER_WORKERS);

      const queueErrorHandler = (error, { serviceDocument }) => {
        const { serviceId, document: { type } } = serviceDocument;
        if (error instanceof InaccessibleContentError) {
          return this.emit('inaccessibleContent', error, serviceId, type);
        }
        this.emit('error', error, serviceId, type);
        this.trackDocumentChangesQueue.kill();
        this.refilterDocumentsQueue.kill();
      };

      this.trackDocumentChangesQueue.error(queueErrorHandler);
      this.refilterDocumentsQueue.error(queueErrorHandler);

      this._serviceDeclarations = await loadServiceDeclarations(SERVICE_DECLARATIONS_PATH);
    }

    return this._serviceDeclarations;
  }

  attach(listener) {
    AVAILABLE_EVENTS.forEach(event => {
      const handlerName = `on${event[0].toUpperCase()}${event.substr(1)}`;

      if (listener[handlerName]) {
        this.on(event, listener[handlerName].bind(listener));
      }
    });
  }

  async trackChanges(servicesIds) {
    this._forEachDocumentOf(servicesIds, serviceDocument => this.trackDocumentChangesQueue.push({ serviceDocument }));

    await this.trackDocumentChangesQueue.drain();
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

    return this.recordVersion({
      snapshotContent: content,
      mimeType,
      snapshotId,
      serviceId,
      documentDeclaration
    });
  }

  async refilterAndRecord(servicesIds) {
    this._forEachDocumentOf(servicesIds, serviceDocument => this.refilterDocumentsQueue.push({ serviceDocument }));

    await this.refilterDocumentsQueue.drain();
    await this.publish();
  }

  async refilterAndRecordDocument({ serviceId, document: documentDeclaration }) {
    const { type } = documentDeclaration;

    const { id: snapshotId, content: snapshotContent, mimeType } = await history.getLatestSnapshot(serviceId, type);

    if (!snapshotId) {
      return;
    }

    return this.recordVersion({
      snapshotContent,
      mimeType,
      snapshotId,
      serviceId,
      documentDeclaration,
      isRefiltering: true
    });
  }

  async _forEachDocumentOf(servicesIds = [], callback) {
    servicesIds.forEach(serviceId => {
      const { documents } = this._serviceDeclarations[serviceId];
      Object.keys(documents).forEach(type => {
        callback({
          serviceId,
          document: {
            type,
            ...documents[type]
          }
        });
      });
    });
  }

  async recordSnapshot({ content, mimeType, serviceId, type }) {
    const { id: snapshotId, isFirstRecord } = await history.recordSnapshot({
      serviceId,
      documentType: type,
      content,
      mimeType
    });

    if (!snapshotId) {
      return this.emit('snapshotNotChanged', serviceId, type);
    }

    this.emit(isFirstRecord ? 'firstSnapshotRecorded' : 'snapshotRecorded', serviceId, type, snapshotId);
    return snapshotId;
  }

  async recordVersion({ snapshotContent, mimeType, snapshotId, serviceId, documentDeclaration, isRefiltering }) {
    const { type } = documentDeclaration;
    const document = await filter({
      content: snapshotContent,
      mimeType,
      documentDeclaration,
      filterFunctions: this._serviceDeclarations[serviceId].filters,
    });

    const recordFunction = !isRefiltering ? 'recordVersion' : 'recordRefilter';

    const { id: versionId, isFirstRecord } = await history[recordFunction]({
      serviceId,
      content: document,
      documentType: type,
      snapshotId
    });

    if (!versionId) {
      return this.emit('versionNotChanged', serviceId, type);
    }

    this.emit(isFirstRecord ? 'firstVersionRecorded' : 'versionRecorded', serviceId, type, versionId);
  }

  async publish() {
    if (!config.get('history.publish')) {
      return;
    }

    await history.publish();
    this.emit('recordsPublished');
  }
}
