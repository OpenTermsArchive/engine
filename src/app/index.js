import path from 'path';
import events from 'events';
import { fileURLToPath } from 'url';

import config from 'config';
import async from 'async';

import * as history from './history/index.js';
import fetch from './fetcher/index.js';
import filter from './filter/index.js';
import loadServiceDeclarations from './loader/index.js';
import { InaccessibleContentError } from './errors.js';
import { extractCssSelectorsFromDocumentDeclaration } from './utils/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_DECLARATIONS_PATH = path.resolve(__dirname, '../../', config.get('serviceDeclarationsPath'));
const MAX_PARALLEL_DOCUMENTS_TRACKS = 20;
const MAX_PARALLEL_REFILTERS = 20;

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
      this.initQueues();
      this._serviceDeclarations = await loadServiceDeclarations(SERVICE_DECLARATIONS_PATH);
    }

    return this._serviceDeclarations;
  }

  initQueues() {
    this.trackDocumentChangesQueue = async.queue(async document => this.trackDocumentChanges(document),
      MAX_PARALLEL_DOCUMENTS_TRACKS);
    this.refilterDocumentsQueue = async.queue(async document => this.refilterAndRecordDocument(document),
      MAX_PARALLEL_REFILTERS);

    const queueErrorHandler = (error, { serviceId, type }) => {
      if (error instanceof InaccessibleContentError) {
        return this.emit('inaccessibleContent', error, serviceId, type);
      }

      this.emit('error', error, serviceId, type);

      throw error;
    };

    this.trackDocumentChangesQueue.error(queueErrorHandler);
    this.refilterDocumentsQueue.error(queueErrorHandler);
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
    this._forEachDocumentOf(servicesIds, document => this.trackDocumentChangesQueue.push(document));

    await this.trackDocumentChangesQueue.drain();
    await this.publish();
  }

  async trackDocumentChanges(documentDeclaration) {
    const { type, serviceId, fetch: location, executeClientScripts } = documentDeclaration;

    const { mimeType, content } = await fetch({
      url: location,
      executeClientScripts,
      cssSelectors: extractCssSelectorsFromDocumentDeclaration(documentDeclaration)
    });

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
    this._forEachDocumentOf(servicesIds, document => this.refilterDocumentsQueue.push(document));

    await this.refilterDocumentsQueue.drain();
    await this.publish();
  }

  async refilterAndRecordDocument(documentDeclaration) {
    const { type, serviceId } = documentDeclaration;

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
          type,
          ...documents[type]
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
