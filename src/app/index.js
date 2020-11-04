import events from 'events';

import config from 'config';
import async from 'async';

import * as history from './history/index.js';
import fetch from './fetcher/index.js';
import filter from './filter/index.js';
import Services from './services/index.js';
import { InaccessibleContentError } from './errors.js';
import { extractCssSelectorsFromDocumentDeclaration } from './utils/index.js';

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
      this._serviceDeclarations = await Services.load();
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

  async trackDocumentChanges(document) {
    const { location, executeClientScripts } = document;

    const { mimeType, content } = await fetch({
      url: location,
      executeClientScripts,
      cssSelectors: extractCssSelectorsFromDocumentDeclaration(document)
    });

    if (!content) {
      return;
    }

    const snapshotId = await this.recordSnapshot({
      content,
      mimeType,
      document,
    });

    if (!snapshotId) {
      return;
    }

    return this.recordVersion({
      snapshotContent: content,
      mimeType,
      snapshotId,
      document
    });
  }

  async refilterAndRecord(servicesIds) {
    this._forEachDocumentOf(servicesIds, document => this.refilterDocumentsQueue.push(document));

    await this.refilterDocumentsQueue.drain();
    await this.publish();
  }

  async refilterAndRecordDocument(document) {
    const { type, serviceId } = document;

    const { id: snapshotId, content: snapshotContent, mimeType } = await history.getLatestSnapshot(serviceId, type);

    if (!snapshotId) {
      return;
    }

    return this.recordVersion({
      snapshotContent,
      mimeType,
      snapshotId,
      document,
      isRefiltering: true
    });
  }

  async _forEachDocumentOf(servicesIds = [], callback) {
    servicesIds.forEach(serviceId => {
      const { documents } = this._serviceDeclarations[serviceId];
      Object.keys(documents).forEach(type => {
        callback(documents[type].latest);
      });
    });
  }

  async recordSnapshot({ content, mimeType, document: { service, type } }) {
    const { id: snapshotId, isFirstRecord } = await history.recordSnapshot({
      serviceId: service.id,
      documentType: type,
      content,
      mimeType
    });

    if (!snapshotId) {
      return this.emit('snapshotNotChanged', service.id, type);
    }

    this.emit(isFirstRecord ? 'firstSnapshotRecorded' : 'snapshotRecorded', service.id, type, snapshotId);
    return snapshotId;
  }

  async recordVersion({ snapshotContent, mimeType, snapshotId, document, isRefiltering }) {
    const { service, type } = document;
    const content = await filter({
      content: snapshotContent,
      mimeType,
      document
    });

    const recordFunction = !isRefiltering ? 'recordVersion' : 'recordRefilter';

    const { id: versionId, isFirstRecord } = await history[recordFunction]({
      serviceId: service.id,
      content,
      documentType: type,
      snapshotId
    });

    if (!versionId) {
      return this.emit('versionNotChanged', service.id, type);
    }

    this.emit(isFirstRecord ? 'firstVersionRecorded' : 'versionRecorded', service.id, type, versionId);
  }

  async publish() {
    if (!config.get('history.publish')) {
      return;
    }

    await history.publish();
    this.emit('recordsPublished');
  }
}
