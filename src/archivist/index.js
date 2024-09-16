import events from 'events';
import async from 'async';
import showdown from 'showdown';

import { InaccessibleContentError } from './errors.js';
import extract, { ExtractDocumentError } from './extract/index.js';
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
  'pluginError',
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
    this.trackingQueue.error((error, { terms }) => {
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
        this.on(event, async (...params) => {
          try {
            await listener[handlerName](...params); // Prefer try...catch over .catch() for handling errors to account for both synchronous and asynchronous functions, as .catch() cannot be applied to synchronous functions
          } catch (error) {
            this.emit('pluginError', error, listener.constructor.name);
          }
        });
      }
    });
  }

  async crawl({ fetch, select }) {
    await launchHeadlessBrowser();

    console.log(fetch);
    console.log(select);

    const sourceDocuments = await this.trackTermsChanges({
      terms: {
        service: {
          id: 'ephemeral'
        },
        sourceDocuments: [
          {
            location: fetch,
            contentSelectors: [ select ]
          }
        ]
      },
      skipSnapshots: true,
      skipRecording: true
    });
    console.log(sourceDocuments);
    await stopHeadlessBrowser();
    const results = await this.extractVersionContent(sourceDocuments);
    const converter = new showdown.Converter();
    const html      = converter.makeHtml(results);
    return html;
  }

  async track({ services: servicesIds = this.servicesIds, types: termsTypes = [], extractOnly = false, skipSnapshots = false, skipReadBack = false, shard } = {}) {
    console.log('track', termsTypes, extractOnly, skipSnapshots, skipReadBack, shard);
    const numberOfTerms = Service.getNumberOfTerms(this.services, servicesIds, termsTypes);

    this.emit('trackingStarted', servicesIds.length, numberOfTerms, extractOnly);

    await Promise.all([ launchHeadlessBrowser(), this.recorder.initialize() ]);

    this.trackingQueue.concurrency = extractOnly ? MAX_PARALLEL_EXTRACTING : MAX_PARALLEL_TRACKING;

    if (typeof shard === 'string') {
      console.log(`Sharding the serviceIds list according to ${shard}`);
      try {
        const parts = shard.split('/');
        if (parts.length === 2) {
          const thisChunk = parseInt(parts[0]);
          const numChunks = parseInt(parts[1]);
          const chunkSize = Math.round(servicesIds.length / numChunks);
          let chunkStart = thisChunk * chunkSize;
          if (isNaN(chunkStart)) {
            throw new Error('chunkStart is not a number');
          }
          let chunkEnd = (thisChunk + 1) * chunkSize;
          if (isNaN(chunkEnd)) {
            throw new Error('chunkEnd is not a number');
          }
          console.log(`sharding ${servicesIds.length} serviceIds according to "${shard}": ${chunkStart} - ${chunkEnd}`);
          servicesIds = servicesIds.slice(chunkStart, chunkEnd);
        }
      } catch (e) {
        console.log('Sharding failed', e.message);
      }
    } else {
      console.log(`No sharding`);
    }
    servicesIds.forEach(serviceId => {
      this.services[serviceId].getTermsTypes().forEach(termsType => {
        if (termsTypes.length && !termsTypes.includes(termsType)) {
          return;
        }

        this.trackingQueue.push({ terms: this.services[serviceId].getTerms({ type: termsType }), extractOnly, skipSnapshots, skipReadBack });
      });
    });

    if (this.trackingQueue.length()) {
      await this.trackingQueue.drain();
    }

    await Promise.all([ stopHeadlessBrowser(), this.recorder.finalize() ]);

    this.emit('trackingCompleted', servicesIds.length, numberOfTerms, extractOnly);
  }

  async trackTermsChanges({ terms, extractOnly = false, skipReadBack = false, skipSnapshots = false, skipRecording = false }) {
    // console.log('trackTermsChanges', terms, extractOnly, skipReadBack, skipSnapshots);
    if (!extractOnly) {
      await this.fetchSourceDocuments(terms);
      if (!skipSnapshots) {
        await this.recordSnapshots(terms);
      }
    }

    if (!skipSnapshots && !skipReadBack) {
      await this.loadSourceDocumentsFromSnapshots(terms);
    }

    if (terms.sourceDocuments.filter(sourceDocument => !sourceDocument.content).length) {
      // If some source documents do not have associated snapshots, it is not possible to generate a fully valid version
      return;
    }

    if (!skipRecording) {
      await this.recordVersion(terms, extractOnly);
    }
    return terms.sourceDocuments;
  }

  async fetchSourceDocuments(terms) {
    terms.fetchDate = new Date();

    const fetchDocumentErrors = [];

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

        fetchDocumentErrors.push(error.message);
      }
    }));

    if (fetchDocumentErrors.length) {
      throw new InaccessibleContentError(fetchDocumentErrors);
    }
  }

  loadSourceDocumentsFromSnapshots(terms) {
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
    const extractDocumentErrors = [];

    const result = await Promise.all(sourceDocuments.map(async sourceDocument => {
      try {
        return await this.extract(sourceDocument);
      } catch (error) {
        if (!(error instanceof ExtractDocumentError)) {
          throw error;
        }

        extractDocumentErrors.push(error.message);
      }
    }));

    if (extractDocumentErrors.length) {
      throw new InaccessibleContentError(extractDocumentErrors);
    }

    return result.join(Version.SOURCE_DOCUMENTS_SEPARATOR);
  }

  async recordVersion(terms, extractOnly) {
    const content = await this.extractVersionContent(terms.sourceDocuments);

    const record = new Version({
      content,
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

  recordSnapshots(terms) {
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
