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

      this.trackDocumentChangesQueue.kill();
      await stopHeadlessBrowser().then(() => console.log('Headless browser stopped'));
      await this.recorder.finalize().then(() => console.log('Recorder finalized'));
      process.exit(1);
    });
  }

  initQueues() {
    this.trackDocumentChangesQueue = async.queue(this.trackDocumentChanges.bind(this), MAX_PARALLEL_DOCUMENTS_TRACKS);

    const queueErrorHandler = async (error, { documentDeclaration }) => {
      const { service, termsType } = documentDeclaration;

      if (error.toString().includes('HttpError: API rate limit exceeded for user ID')) {
        return; // This is an error due to SendInBlue quota, bypass
      }

      if (error instanceof InaccessibleContentError) {
        this.emit('inaccessibleContent', error, service.id, termsType, documentDeclaration);

        return;
      }

      this.emit('error', error, service.id, termsType);
    };

    this.trackDocumentChangesQueue.error(queueErrorHandler);
  }

  attach(listener) {
    AVAILABLE_EVENTS.forEach(event => {
      const handlerName = `on${event[0].toUpperCase()}${event.substring(1)}`;

      if (listener[handlerName]) {
        this.on(event, listener[handlerName].bind(listener));
      }
    });
  }

  async trackChanges({ servicesIds = this.serviceIds, termsTypes = [], refilterOnly }) {
    this.emit(refilterOnly ? 'refilteringStarted' : 'trackingStarted', servicesIds.length, this.getNumberOfDocuments(servicesIds));

    await Promise.all([ launchHeadlessBrowser(), this.recorder.initialize() ]);

    this.trackDocumentChangesQueue.concurrency = refilterOnly ? MAX_PARALLEL_REFILTERS : MAX_PARALLEL_DOCUMENTS_TRACKS;

    this.#forEachDocumentOf(servicesIds, termsTypes, documentDeclaration => this.trackDocumentChangesQueue.push({ documentDeclaration, refilterOnly }));

    await this.trackDocumentChangesQueue.drain();
    await Promise.all([ stopHeadlessBrowser(), this.recorder.finalize() ]);

    this.emit(refilterOnly ? 'refilteringCompleted' : 'trackingCompleted', servicesIds.length, this.getNumberOfDocuments(servicesIds));
  }

  async trackDocumentChanges({ documentDeclaration, refilterOnly }) {
    if (!refilterOnly) {
      await Promise.all((await this.fetchDocumentPages(documentDeclaration)).map(params => this.recordSnapshot(params)));
    }

    return this.generateDocumentVersion(documentDeclaration, { refilterOnly });
  }

  async generateDocumentVersion(documentDeclaration, { refilterOnly = false } = {}) {
    const { service: { id: serviceId }, termsType, pages } = documentDeclaration;

    const snapshots = await this.getDocumentSnapshots(documentDeclaration);

    if (!snapshots.length) {
      return;
    }

    const [{ fetchDate }] = snapshots; // In case of multipage document, use the first snapshot fetch date

    return this.recordVersion({
      content: await this.generateDocumentFilteredContent(snapshots, pages),
      snapshotIds: snapshots.map(({ id }) => id),
      serviceId,
      termsType,
      fetchDate,
      isRefiltering: refilterOnly,
    });
  }

  async fetchDocumentPages({ service: { id: serviceId }, termsType, pages, isMultiPage }) {
    const inaccessibleContentErrors = [];

    const result = await Promise.all(pages.map(async ({ location: url, executeClientScripts, cssSelectors, id: pageId }) => {
      try {
        const { mimeType, content } = await this.fetch({ url, executeClientScripts, cssSelectors });

        return {
          content,
          mimeType,
          serviceId,
          termsType,
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

  async getDocumentSnapshots({ service: { id: serviceId }, termsType, pages, isMultiPage }) {
    return (await Promise.all(pages.map(async page => this.recorder.getLatestSnapshot(serviceId, termsType, isMultiPage && page.id)))).filter(Boolean);
  }

  async generateDocumentFilteredContent(snapshots, pages) {
    return (
      await Promise.all(snapshots.map(async ({ pageId, content, mimeType }) => {
        const pageDeclaration = pageId ? pages.find(({ id }) => pageId == id) : pages[0];

        return this.filter({ content, mimeType, pageDeclaration });
      }))
    ).join('\n\n');
  }

  async recordSnapshot({ content, mimeType, fetchDate, serviceId, termsType, pageId }) {
    const { id: snapshotId, isFirstRecord } = await this.recorder.recordSnapshot({
      serviceId,
      termsType,
      pageId,
      content,
      mimeType,
      fetchDate,
    });

    if (!snapshotId) {
      this.emit('snapshotNotChanged', serviceId, termsType, pageId);

      return;
    }

    this.emit(isFirstRecord ? 'firstSnapshotRecorded' : 'snapshotRecorded', serviceId, termsType, pageId, snapshotId);

    return snapshotId;
  }

  async recordVersion({ content, fetchDate, snapshotIds, serviceId, termsType, isRefiltering }) {
    const recordFunction = !isRefiltering ? 'recordVersion' : 'recordRefilter';

    const { id: versionId, isFirstRecord } = await this.recorder[recordFunction]({
      serviceId,
      termsType,
      content,
      fetchDate,
      snapshotIds,
    });

    if (!versionId) {
      this.emit('versionNotChanged', serviceId, termsType);

      return;
    }

    this.emit(isFirstRecord ? 'firstVersionRecorded' : 'versionRecorded', serviceId, termsType, versionId);
  }

  getNumberOfDocuments(serviceIds = this.serviceIds) {
    return serviceIds.reduce((acc, serviceId) => acc + this.services[serviceId].getNumberOfDocuments(), 0);
  }

  async #forEachDocumentOf(servicesIds = [], termsTypes = [], callback) { // eslint-disable-line default-param-last
    servicesIds.sort((a, b) => a.localeCompare(b)); // Sort service IDs by lowercase name to have more intuitive logs
    servicesIds.forEach(serviceId => {
      this.services[serviceId].getDocumentTypes().forEach(termsType => {
        if (termsTypes.length && !termsTypes.includes(termsType)) {
          return;
        }

        callback(this.services[serviceId].getDocumentDeclaration(termsType));
      });
    });
  }
}
