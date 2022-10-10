import events from 'events';

import async from 'async';
import config from 'config';

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

export default class Archivist extends events.EventEmitter {
  get serviceDeclarations() {
    return this.services;
  }

  get serviceIds() {
    return Object.keys(this.services);
  }

  constructor({ recorderConfig }) {
    super();
    this.recorder = new Recorder(recorderConfig);
    this.fetch = params => fetch({ ...params, config: config.get('fetcher') });
    this.filter = filter;
  }

  async initialize() {
    if (this.services) {
      return;
    }

    await this.recorder.initialize();
    this.initQueues();
    this.services = await services.load();

    this.on('error', async () => {
      console.log('Abort and clean up operations before exiting…');

      setTimeout(() => {
        console.log('Cleaning timed out, force process to exit');
        process.exit(2);
      }, 60 * 1000);

      this.refilterDocumentsQueue.kill();
      this.trackDocumentChangesQueue.kill();
      await stopHeadlessBrowser().then(() => console.log('Headless browser stopped'));
      await this.recorder.finalize().then(() => console.log('Recorder finalized'));
      process.exit(1);
    });
  }

  initQueues() {
    this.trackDocumentChangesQueue = async.queue(async documentDeclaration => this.trackDocumentChanges(documentDeclaration), MAX_PARALLEL_DOCUMENTS_TRACKS);
    this.refilterDocumentsQueue = async.queue(async documentDeclaration => this.refilterAndRecordDocument(documentDeclaration), MAX_PARALLEL_REFILTERS);

    const queueErrorHandler = async (error, documentDeclaration) => {
      const { service, type } = documentDeclaration;

      if (error.toString().includes('HttpError: API rate limit exceeded for user ID')) {
        return; // This is an error due to SendInBlue quota, bypass
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
      const handlerName = `on${event[0].toUpperCase()}${event.substring(1)}`;

      if (listener[handlerName]) {
        this.on(event, listener[handlerName].bind(listener));
      }
    });
  }

  async trackChanges(servicesIds = this.serviceIds, documentTypes = []) {
    this.emit('trackingStarted', servicesIds.length, this.getNumberOfDocuments(servicesIds));

    await Promise.all([ launchHeadlessBrowser(), this.recorder.initialize() ]);

    this.#forEachDocumentOf(servicesIds, documentTypes, documentDeclaration => this.trackDocumentChangesQueue.push(documentDeclaration));

    await this.trackDocumentChangesQueue.drain();
    await Promise.all([ stopHeadlessBrowser(), this.recorder.finalize() ]);

    this.emit('trackingCompleted', servicesIds.length, this.getNumberOfDocuments(servicesIds));
  }

  async refilterAndRecord(servicesIds = this.serviceIds, documentTypes = []) {
    this.emit('refilteringStarted', servicesIds.length, this.getNumberOfDocuments(servicesIds));

    await this.recorder.initialize();

    this.#forEachDocumentOf(servicesIds, documentTypes, documentDeclaration => this.refilterDocumentsQueue.push(documentDeclaration));

    await this.refilterDocumentsQueue.drain();
    await this.recorder.finalize();

    this.emit('refilteringCompleted', servicesIds.length, this.getNumberOfDocuments(servicesIds));
  }

  async trackDocumentChanges(documentDeclaration) {
    await Promise.all((await this.fetchDocumentPages(documentDeclaration)).map(params => this.recordSnapshot(params)));

    return this.generateDocumentVersion(documentDeclaration);
  }

  async refilterAndRecordDocument(documentDeclaration) {
    return this.generateDocumentVersion(documentDeclaration, { isRefiltering: true });
  }

  async generateDocumentVersion(documentDeclaration, { isRefiltering = false } = {}) {
    const { service: { id: serviceId }, type: documentType, pages } = documentDeclaration;

    const snapshots = await this.getDocumentSnapshots(documentDeclaration);

    if (!snapshots.length) {
      return;
    }

    const [{ fetchDate }] = snapshots; // In case of multipage document, use the first snapshot fetch date

    return this.recordVersion({
      content: await this.generateDocumentFilteredContent(snapshots, pages),
      snapshotIds: snapshots.map(({ id }) => id),
      serviceId,
      documentType,
      fetchDate,
      isRefiltering,
    });
  }

  async fetchDocumentPages({ service: { id: serviceId }, type: documentType, pages, isMultiPage }) {
    const inaccessibleContentErrors = [];

    const result = await Promise.all(pages.map(async ({ location: url, executeClientScripts, cssSelectors, id: pageId }) => {
      try {
        const { mimeType, content } = await this.fetch({ url, executeClientScripts, cssSelectors });

        return {
          content,
          mimeType,
          serviceId,
          documentType,
          pageId: isMultiPage && pageId,
          fetchDate: new Date(),
        };
      } catch (error) {
        if (!(error instanceof FetchDocumentError)) {
          throw error;
        }

        if (error.message.includes('EAI_AGAIN')) {
          // EAI_AGAIN is a DNS lookup timed out error, which means it is a network connectivity error or proxy related error.
          // This operational error is mostly transient and should be handled by retrying the operation.
          // As there is no retry mechanism in the engine yet, crash the engine and leave it to the process
          // manager to handle the retries and the delay between them.
          throw error;
        }

        inaccessibleContentErrors.push(error.message);
      }
    }));

    if (inaccessibleContentErrors.length) {
      throw new InaccessibleContentError(inaccessibleContentErrors);
    }

    return result;
  }

  async getDocumentSnapshots({ service: { id: serviceId }, type: documentType, pages, isMultiPage }) {
    return (await Promise.all(pages.map(async page => this.recorder.getLatestSnapshot(serviceId, documentType, isMultiPage && page.id)))).filter(Boolean);
  }

  async generateDocumentFilteredContent(snapshots, pages) {
    return (
      await Promise.all(snapshots.map(async ({ pageId, content, mimeType }) => {
        const pageDeclaration = pageId ? pages.find(({ id }) => pageId == id) : pages[0];

        return this.filter({ content, mimeType, pageDeclaration });
      }))
    ).join('\n\n');
  }

  async recordSnapshot({ content, mimeType, fetchDate, serviceId, documentType, pageId }) {
    const { id: snapshotId, isFirstRecord } = await this.recorder.recordSnapshot({
      serviceId,
      documentType,
      pageId,
      content,
      mimeType,
      fetchDate,
    });

    if (!snapshotId) {
      this.emit('snapshotNotChanged', serviceId, documentType, pageId);

      return;
    }

    this.emit(isFirstRecord ? 'firstSnapshotRecorded' : 'snapshotRecorded', serviceId, documentType, pageId, snapshotId);

    return snapshotId;
  }

  async recordVersion({ content, fetchDate, snapshotIds, serviceId, documentType, isRefiltering }) {
    const recordFunction = !isRefiltering ? 'recordVersion' : 'recordRefilter';

    const { id: versionId, isFirstRecord } = await this.recorder[recordFunction]({
      serviceId,
      documentType,
      content,
      fetchDate,
      snapshotIds,
    });

    if (!versionId) {
      this.emit('versionNotChanged', serviceId, documentType);

      return;
    }

    this.emit(isFirstRecord ? 'firstVersionRecorded' : 'versionRecorded', serviceId, documentType, versionId);
  }

  getNumberOfDocuments(serviceIds = this.serviceIds) {
    return serviceIds.reduce((acc, serviceId) => acc + this.services[serviceId].getNumberOfDocuments(), 0);
  }

  async #forEachDocumentOf(servicesIds = [], documentTypes = [], callback) { // eslint-disable-line default-param-last
    servicesIds.sort((a, b) => a.localeCompare(b)); // Sort service IDs by lowercase name to have more intuitive logs
    servicesIds.forEach(serviceId => {
      this.services[serviceId].getDocumentTypes().forEach(documentType => {
        if (documentTypes.length && !documentTypes.includes(documentType)) {
          return;
        }

        callback(this.services[serviceId].getDocumentDeclaration(documentType));
      });
    });
  }
}
