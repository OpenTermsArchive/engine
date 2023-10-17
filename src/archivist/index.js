import events from 'events';

import async from 'async';

import { InaccessibleContentError } from './errors.js';
import extract from './extract/index.js';
import fetch, { launchHeadlessBrowser, stopHeadlessBrowser, FetchDocumentError } from './fetcher/index.js';
import Recorder from './recorder/index.js';
import Snapshot from './recorder/snapshot.js';
import Version from './recorder/version.js';
import * as services from './services/index.js';
import Service from './services/service.js';

// The parallel handling feature is currently set to a parallelism of 1 on terms tracking
// because when it's higher there are two issues:
// - too many requests on the same endpoint yield 403
// - sometimes when creating a commit no SHA are returned for unknown reasons
const MAX_PARALLEL_TRACKING = 1;
const MAX_PARALLEL_EXTRACTING = 10;

export const EVENTS = [
  'snapshotRecorded',
  'firstSnapshotRecorded',
  'snapshotNotChanged',
  'versionRecorded',
  'firstVersionRecorded',
  'versionNotChanged',
  'trackingStarted',
  'trackingCompleted',
  'inaccessibleContent',
  'error',
];

export default class Archivist extends events.EventEmitter {
  get servicesIds() {
    return Object.keys(this.services).sort((a, b) => a.localeCompare(b)); // Sort service IDs by lowercase name to have more intuitive logs;
  }

  constructor({ recorderConfig, fetcherConfig }) {
    super();
    this.recorder = new Recorder(recorderConfig);
    this.fetch = params => fetch({ ...params, config: fetcherConfig });
    this.extract = extract;
  }

  async initialize() {
    if (this.services) {
      return;
    }

    await this.recorder.initialize();
    this.initQueue();
    this.services = await services.load();

    this.on('error', async () => {
      console.log('Abort and clean up operations before exiting…');

      setTimeout(() => {
        console.log('Cleaning timed out, force process to exit');
        process.exit(2);
      }, 60 * 1000);

      this.trackingQueue.kill();
      await stopHeadlessBrowser().then(() => console.log('Headless browser stopped'));
      await this.recorder.finalize().then(() => console.log('Recorder finalized'));
      process.exit(1);
    });

    return this;
  }

  initQueue() {
    this.trackingQueue = async.queue(this.trackTermsChanges.bind(this), MAX_PARALLEL_TRACKING);
    this.trackingQueue.error(async (error, { terms }) => {
      if (error.toString().includes('HttpError: API rate limit exceeded for user ID')) {
        return; // This is an error due to SendInBlue quota, bypass
      }

      if (error instanceof InaccessibleContentError) {
        this.emit('inaccessibleContent', error, terms);

        return;
      }

      this.emit('error', error, terms);
    });
  }

  attach(listener) {
    EVENTS.forEach(event => {
      const handlerName = `on${event[0].toUpperCase()}${event.substring(1)}`;

      if (listener[handlerName]) {
        this.on(event, listener[handlerName].bind(listener));
      }
    });
  }

  async track({ services: servicesIds = this.servicesIds, terms: termsTypes = [], extractOnly = false }) {
    this.emit('trackingStarted', servicesIds.length, Service.getNumberOfTerms(this.services, servicesIds), extractOnly);
    await Promise.all([ launchHeadlessBrowser(), this.recorder.initialize() ]);

    this.trackingQueue.concurrency = extractOnly ? MAX_PARALLEL_EXTRACTING : MAX_PARALLEL_TRACKING;

    servicesIds.forEach(serviceId => {
      this.services[serviceId].getTermsTypes().forEach(termsType => {
        if (termsTypes.length && !termsTypes.includes(termsType)) {
          return;
        }

        this.trackingQueue.push({ terms: this.services[serviceId].getTerms({ type: termsType }), extractOnly });
      });
    });

    await this.trackingQueue.drain();

    await Promise.all([ stopHeadlessBrowser(), this.recorder.finalize() ]);
    this.emit('trackingCompleted', servicesIds.length, Service.getNumberOfTerms(this.services, servicesIds), extractOnly);
  }

  async trackTermsChanges({ terms, extractOnly = false }) {
    if (!extractOnly) {
      await this.fetchSourceDocuments(terms);
      await this.recordSnapshots(terms);
    }

    await this.loadSourceDocumentsFromSnapshots(terms);

    if (terms.sourceDocuments.filter(sourceDocument => !sourceDocument.content).length) {
      // If some source documents do not have associated snapshots, it is not possible to generate a fully valid version
      return;
    }

    return this.recordVersion(terms, extractOnly);
  }

  async fetchSourceDocuments(terms) {
    terms.fetchDate = new Date();

    const inaccessibleContentErrors = [];

    await Promise.all(terms.sourceDocuments.map(async sourceDocument => {
      const { location: url, executeClientScripts, cssSelectors } = sourceDocument;

      try {
        const { mimeType, content } = await this.fetch({ url, executeClientScripts, cssSelectors });

        sourceDocument.content = content;
        sourceDocument.mimeType = mimeType;
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
  }

  async loadSourceDocumentsFromSnapshots(terms) {
    return Promise.all(terms.sourceDocuments.map(async sourceDocument => {
      const snapshot = await this.recorder.getLatestSnapshot(terms, sourceDocument.id);

      if (!snapshot) { // This can happen if one of the source documents for a terms has not yet been fetched
        return;
      }

      sourceDocument.content = snapshot.content;
      sourceDocument.mimeType = snapshot.mimeType;
      sourceDocument.snapshotId = snapshot.id;
      terms.fetchDate = snapshot.fetchDate;
    }));
  }

  async extractVersionContent(sourceDocuments) {
    return (await Promise.all(sourceDocuments.map(async sourceDocument => this.extract(sourceDocument)))).join(Version.SOURCE_DOCUMENTS_SEPARATOR);
  }

  async recordVersion(terms, extractOnly) {
    const record = new Version({
      content: await this.extractVersionContent(terms.sourceDocuments),
      snapshotIds: terms.sourceDocuments.map(sourceDocuments => sourceDocuments.snapshotId),
      serviceId: terms.service.id,
      termsType: terms.type,
      fetchDate: terms.fetchDate,
      isExtractOnly: extractOnly,
    });

    await this.recorder.record(record);

    if (!record.id) {
      this.emit('versionNotChanged', record);

      return record;
    }

    this.emit(record.isFirstRecord ? 'firstVersionRecorded' : 'versionRecorded', record);

    return record;
  }

  async recordSnapshots(terms) {
    return Promise.all(terms.sourceDocuments.map(async sourceDocument => {
      const record = new Snapshot({
        serviceId: terms.service.id,
        termsType: terms.type,
        documentId: terms.hasMultipleSourceDocuments && sourceDocument.id,
        fetchDate: terms.fetchDate,
        content: sourceDocument.content,
        mimeType: sourceDocument.mimeType,
      });

      await this.recorder.record(record);

      if (!record.id) {
        this.emit('snapshotNotChanged', record);

        return record;
      }

      sourceDocument.snapshotId = record.id;

      this.emit(record.isFirstRecord ? 'firstSnapshotRecorded' : 'snapshotRecorded', record);

      return record;
    }));
  }
}
