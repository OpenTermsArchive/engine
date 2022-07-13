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

    this.#forEachDocumentOf(servicesIds, documentDeclaration => this.trackDocumentChangesQueue.push(documentDeclaration));

    await this.trackDocumentChangesQueue.drain();

    await Promise.all([ stopHeadlessBrowser(), this.recorder.finalize() ]);

    this.emit('trackingCompleted', servicesIds.length, this.getNumberOfDocuments(servicesIds));
  }

  async trackDocumentChanges(documentDeclaration) {
    const { service: { id: serviceId }, type: documentType, pages } = documentDeclaration;

    const snapshots = [];
    const snapshotIds = [];
    const contents = [];
    let fetchDate;

    /* eslint-disable no-await-in-loop */
    for (const page of pages) {
      const { location, executeClientScripts } = page;

      let mimeType;
      let content;
      const pageId = documentDeclaration.isMultiPage() && page.id;

      try {
        ({ mimeType, content } = await fetch({
          url: location,
          executeClientScripts,
          cssSelectors: page.getCssSelectors(),
          config: config.get('fetcher'),
        }));
        fetchDate = new Date();
      } catch (error) {
        if (error instanceof FetchDocumentError) {
          if (error.message.includes('EAI_AGAIN')) {
          // EAI_AGAIN is a DNS lookup timed out error, which means it is a network connectivity error or proxy related error.
          // This operational error is mostly transient and should be handled by retrying the operation.
          // As there is no retry mechanism in the engine yet, crash the engine and leave it to the process
          // manager to handle the retries and the delay between them.
            throw error;
          } else {
            throw new InaccessibleContentError(error.message);
          }
        }

        throw error;
      }

      let snapshotId = await this.recordSnapshot({
        content,
        mimeType,
        serviceId,
        documentType,
        pageId,
        fetchDate,
      });

      if (!snapshotId && documentDeclaration.isMultiPage()) { // on multi-page documents, where one of the pages has not been changed, use the last saved snapshot to ensure that this page is present in the version
        ({ id: snapshotId, content, mimeType, fetchDate } = await this.recorder.getLatestSnapshot(serviceId, documentType, pageId));
      }

      snapshots.push({
        snapshotId,
        content,
        mimeType,
        fetchDate,
        page,
      });
    }

    for (const { snapshotId, content, mimeType, page } of snapshots) {
      if (!snapshotId) {
        continue;
      }

      snapshotIds.push(snapshotId);

      const versionContent = await filter({
        content,
        mimeType,
        pageDeclaration: page,
      });

      contents.push(versionContent);
    }

    if (!snapshotIds.length) {
      return;
    }

    const recordedVersion = await this.recordVersion({
      content: contents.join('\n\n'),
      snapshotIds,
      serviceId,
      documentType,
      fetchDate,
    });

    return recordedVersion;
  }

  async refilterAndRecord(servicesIds = this.serviceIds) {
    servicesIds.sort((a, b) => a.localeCompare(b)); // Sort service ids by lowercase name to have more intuitive logs

    this.emit('refilteringStarted', servicesIds.length, this.getNumberOfDocuments(servicesIds));

    await this.recorder.initialize();

    this.#forEachDocumentOf(servicesIds, documentDeclaration => this.refilterDocumentsQueue.push(documentDeclaration));

    await this.refilterDocumentsQueue.drain();
    await this.recorder.finalize();

    this.emit('refilteringCompleted', servicesIds.length, this.getNumberOfDocuments(servicesIds));
  }

  async refilterAndRecordDocument(documentDeclaration) {
    const { service: { id: serviceId }, type: documentType, pages } = documentDeclaration;

    const snapshots = [];
    const contents = [];
    let fetchDate;

    for (const page of pages) {
      const pageId = documentDeclaration.isMultiPage() && page.id;
      const { id: snapshotId, content, mimeType, fetchDate: snapshotFetchDate } = await this.recorder.getLatestSnapshot(serviceId, documentType, pageId);

      if (!snapshotId) {
        continue;
      }

      fetchDate = snapshotFetchDate;

      snapshots.push({
        snapshotId,
        content,
        mimeType,
        fetchDate: snapshotFetchDate,
        page,
      });
    }

    for (const { snapshotId, content, mimeType, page } of snapshots) {
      if (!snapshotId) {
        continue;
      }

      const versionContent = await filter({ content, mimeType, pageDeclaration: page });

      contents.push(versionContent);
    }

    if (!snapshots.length) {
      return;
    }

    return this.recordVersion({
      content: contents.join('\n\n'),
      snapshotIds: snapshots.map(({ snapshotId }) => snapshotId),
      serviceId,
      documentType,
      fetchDate,
      isRefiltering: true,
    });
  }

  async #forEachDocumentOf(servicesIds = [], callback) { // eslint-disable-line default-param-last
    servicesIds.forEach(serviceId => {
      this.services[serviceId].getDocumentTypes().forEach(documentType => {
        callback(this.services[serviceId].getDocumentDeclaration(documentType));
      });
    });
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
}
