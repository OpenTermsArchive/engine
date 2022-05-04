import events from 'events';

import async from 'async';

import { InaccessibleContentError } from './errors.js';
import fetch, { launchHeadlessBrowser, stopHeadlessBrowser, FetchDocumentError } from './fetcher/index.js';
import filter from './filter/index.js';
import Recorder from './recorder/index.js';
import * as services from './services/index.js';

// The parallel handling feature is currently set to a parallelism of 1 on document tracking
// because when it's higher there are two issues:
// - too many requests on the same endpoint yield 403
// - sometimes when creating a commit no SHA are returned for unknown reasons
const MAX_PARALLEL_DOCUMENTS_TRACKS = 1;
const MAX_PARALLEL_REFILTERS = 10;

export const AVAILABLE_EVENTS = [
  'snapshotRecorded',
  'firstSnapshotRecorded',
  'snapshotNotChanged',
  'versionRecorded',
  'firstVersionRecorded',
  'versionNotChanged',
  'refilteringStarted',
  'refilteringCompleted',
  'trackingStarted',
  'trackingCompleted',
  'inaccessibleContent',
  'error',
];

const MARKDOWN_MIME_TYPE = 'text/markdown';

export default class Archivist extends events.EventEmitter {
  get serviceDeclarations() {
    return this.services;
  }

  get serviceIds() {
    return Object.keys(this.services);
  }

  constructor({ storage: { versions, snapshots } }) {
    super();
    this.recorder = new Recorder({ versionsStorageAdapter: versions, snapshotsStorageAdapter: snapshots });
  }

  async initialize() {
    if (this.services) {
      return;
    }

    await this.recorder.initialize();
    this.initQueues();
    this.services = await services.load();

    this.on('error', async () => {
      this.refilterDocumentsQueue.kill();
      this.trackDocumentChangesQueue.kill();
      stopHeadlessBrowser();
      await this.recorder.finalize();
    });
  }

  initQueues() {
    this.trackDocumentChangesQueue = async.queue(async documentDeclaration => this.trackDocumentChanges(documentDeclaration), MAX_PARALLEL_DOCUMENTS_TRACKS);
    this.refilterDocumentsQueue = async.queue(async documentDeclaration => this.refilterAndRecordDocument(documentDeclaration), MAX_PARALLEL_REFILTERS);

    const queueErrorHandler = async (error, documentDeclaration) => {
      const { service, type } = documentDeclaration;

      if (error.toString().includes('HttpError: API rate limit exceeded for user ID')) {
        // This is an error due to SendInBlue quota, bypass
        return;
      }

      if (error instanceof InaccessibleContentError) {
        this.emit('inaccessibleContent', error, service.id, type, documentDeclaration);

        return;
      }

      this.emit('error', error, service.id, type);
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

  async trackChanges(servicesIds = this.serviceIds) {
    servicesIds.sort((a, b) => a.localeCompare(b)); // Sort service ids by lowercase name to have more intuitive logs

    this.emit('trackingStarted', servicesIds.length, this.getNumberOfDocuments(servicesIds));

    await Promise.all([ launchHeadlessBrowser(), this.recorder.initialize() ]);

    this._forEachDocumentOf(servicesIds, documentDeclaration => this.trackDocumentChangesQueue.push(documentDeclaration));

    await this.trackDocumentChangesQueue.drain();

    await Promise.all([ stopHeadlessBrowser(), this.recorder.finalize() ]);

    this.emit('trackingCompleted', servicesIds.length, this.getNumberOfDocuments(servicesIds));
  }

  async trackDocumentChanges(documentDeclaration) {
    const { location, executeClientScripts } = documentDeclaration;

    let mimeType;
    let content;

    try {
      ({ mimeType, content } = await fetch({
        url: location,
        executeClientScripts,
        cssSelectors: documentDeclaration.getCssSelectors(),
      }));
    } catch (error) {
      if (error instanceof FetchDocumentError) {
        throw new InaccessibleContentError(error.message);
      }

      throw error;
    }

    const fetchDate = new Date();
    const snapshotId = await this.recordSnapshot({
      content,
      mimeType,
      documentDeclaration,
      fetchDate,
    });

    if (!snapshotId) {
      return;
    }

    const recordedVersion = await this.recordVersion({
      snapshotContent: content,
      mimeType,
      snapshotId,
      documentDeclaration,
      fetchDate,
    });

    return recordedVersion;
  }

  async refilterAndRecord(servicesIds = this.serviceIds) {
    servicesIds.sort((a, b) => a.localeCompare(b)); // Sort service ids by lowercase name to have more intuitive logs

    this.emit('refilteringStarted', servicesIds.length, this.getNumberOfDocuments(servicesIds));

    await this.recorder.initialize();

    this._forEachDocumentOf(servicesIds, documentDeclaration => this.refilterDocumentsQueue.push(documentDeclaration));

    await this.refilterDocumentsQueue.drain();
    await this.recorder.finalize();

    this.emit('refilteringCompleted', servicesIds.length, this.getNumberOfDocuments(servicesIds));
  }

  async refilterAndRecordDocument(documentDeclaration) {
    const { type, service } = documentDeclaration;

    const { id: snapshotId, content: snapshotContent, mimeType, fetchDate } = await this.recorder.getLatestSnapshot(
      service.id,
      type,
    );

    if (!snapshotId) {
      return;
    }

    return this.recordVersion({
      snapshotContent,
      mimeType,
      snapshotId,
      documentDeclaration,
      isRefiltering: true,
      fetchDate,
    });
  }

  async _forEachDocumentOf(servicesIds = [], callback) { // eslint-disable-line default-param-last
    servicesIds.forEach(serviceId => {
      this.services[serviceId].getDocumentTypes().forEach(documentType => {
        callback(this.services[serviceId].getDocumentDeclaration(documentType));
      });
    });
  }

  async recordSnapshot({ content, mimeType, fetchDate, documentDeclaration: { service, type } }) {
    const { id: snapshotId, isFirstRecord } = await this.recorder.recordSnapshot({
      serviceId: service.id,
      documentType: type,
      content,
      mimeType,
      fetchDate,
    });

    if (!snapshotId) {
      return this.emit('snapshotNotChanged', service.id, type);
    }

    this.emit(isFirstRecord ? 'firstSnapshotRecorded' : 'snapshotRecorded', service.id, type, snapshotId);

    return snapshotId;
  }

  async recordVersion({ snapshotContent, mimeType, fetchDate, snapshotId, documentDeclaration, isRefiltering }) {
    const { service, type } = documentDeclaration;
    const content = await filter({
      content: snapshotContent,
      mimeType,
      documentDeclaration,
    });

    const recordFunction = !isRefiltering ? 'recordVersion' : 'recordRefilter';

    const { id: versionId, isFirstRecord } = await this.recorder[recordFunction]({
      serviceId: service.id,
      documentType: type,
      content,
      mimeType: MARKDOWN_MIME_TYPE, // The result of the `filter` function is always in markdown format
      fetchDate,
      snapshotId,
    });

    if (!versionId) {
      return this.emit('versionNotChanged', service.id, type);
    }

    this.emit(isFirstRecord ? 'firstVersionRecorded' : 'versionRecorded', service.id, type, versionId);
  }

  getNumberOfDocuments(serviceIds = this.serviceIds) {
    return serviceIds.reduce((acc, serviceId) => acc + this.services[serviceId].getNumberOfDocuments(), 0);
  }
}
