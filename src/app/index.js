import async from 'async';
import config from 'config';
import events from 'events';
import pTimeout from '@lolpants/ptimeout';
import * as history from './history/index.js';
import * as services from './services/index.js';

import { InaccessibleContentError } from './errors.js';
import fetch from './fetcher/index.js';
import filter from './filter/index.js';
import logger from '../logger/index.js';

const MAX_PARALLEL_DOCUMENTS_TRACKS = 1;
const MAX_PARALLEL_REFILTERS = 1;
const MAX_EXECUTION_TIME = 5 * 60 * 1000;

export const AVAILABLE_EVENTS = [
  'snapshotRecorded',
  'firstSnapshotRecorded',
  'snapshotNotChanged',
  'versionRecorded',
  'firstVersionRecorded',
  'versionNotChanged',
  'recordsPublished',
  'inaccessibleContent',
  'error',
];

export default class CGUs extends events.EventEmitter {
  get serviceDeclarations() {
    return this.services;
  }

  get serviceIds() {
    return Object.keys(this.services);
  }

  async init() {
    if (!this.services) {
      this.initQueues();
      this.services = await services.load();
      await history.init();
    }

    return this.services;
  }

  initQueues() {
    this.trackDocumentChangesQueue = async.queue(async (documentDeclaration) => {
      const timeMessage = `trackDocumentChangesQueue_${documentDeclaration.service.id}_${documentDeclaration.type}`;
      console.time(timeMessage);
      try {
        const result = await pTimeout.default(
          async () => this.trackDocumentChanges(documentDeclaration),
          MAX_EXECUTION_TIME
        );
        console.timeEnd(timeMessage);
        return result;
      } catch (e) {
        console.timeEnd(timeMessage);
        if (!(e instanceof pTimeout.TimeoutError)) {
          throw e;
        }

        logger.error({
          message: e.toString(),
          serviceId: documentDeclaration.service.id,
          type: documentDeclaration.type,
        });
      }
    }, MAX_PARALLEL_DOCUMENTS_TRACKS);
    this.refilterDocumentsQueue = async.queue(async (documentDeclaration) => {
      const timeMessage = `refilterDocumentsQueue_${documentDeclaration.service.id}_${documentDeclaration.type}`;
      console.time(timeMessage);
      try {
        const result = await pTimeout.default(
          async () => this.refilterAndRecordDocument(documentDeclaration),
          MAX_EXECUTION_TIME
        );
        console.timeEnd(timeMessage);
        return result;
      } catch (e) {
        console.timeEnd(timeMessage);
        if (!(e instanceof pTimeout.TimeoutError)) {
          throw e;
        }

        logger.error({
          message: e.toString(),
          serviceId: documentDeclaration.service.id,
          type: documentDeclaration.type,
        });
      }
    }, MAX_PARALLEL_REFILTERS);

    const queueErrorHandler = (error, { service, type }) => {
      if (error instanceof InaccessibleContentError) {
        return this.emit('inaccessibleContent', error, service.id, type);
      }

      this.emit('error', error, service.id, type);

      throw error;
    };

    this.trackDocumentChangesQueue.error(queueErrorHandler);
    this.refilterDocumentsQueue.error(queueErrorHandler);
  }

  attach(listener) {
    AVAILABLE_EVENTS.forEach((event) => {
      const handlerName = `on${event[0].toUpperCase()}${event.substr(1)}`;

      if (listener[handlerName]) {
        this.on(event, listener[handlerName].bind(listener));
      }
    });
  }

  async trackChanges(servicesIds) {
    this._forEachDocumentOf(servicesIds, (documentDeclaration) =>
      this.trackDocumentChangesQueue.push(documentDeclaration));

    await this.trackDocumentChangesQueue.drain();
    await this.publish();
  }

  async trackDocumentChanges(documentDeclaration) {
    const {
      location,
      executeClientScripts,
      service,
      contentSelectors,
      noiseSelectors,
      type,
    } = documentDeclaration;

    try {
      const { mimeType, content } = await fetch({
        url: location,
        executeClientScripts,
        cssSelectors: documentDeclaration.getCssSelectors(),
      });

      if (!content) {
        return;
      }

      const snapshotId = await this.recordSnapshot({
        content,
        mimeType,
        documentDeclaration,
      });

      if (!snapshotId) {
        return;
      }

      return this.recordVersion({
        snapshotContent: content,
        mimeType,
        snapshotId,
        documentDeclaration,
      });
    } catch (e) {
      if (e instanceof InaccessibleContentError) {
        // send error with more info
        throw new InaccessibleContentError({
          contentSelectors,
          noiseSelectors,
          url: location,
          name: service.id,
          documentType: type,
          message: e.toString(),
        });
      }
      throw e;
    }
  }

  async refilterAndRecord(servicesIds) {
    this._forEachDocumentOf(servicesIds, (documentDeclaration) =>
      this.refilterDocumentsQueue.push(documentDeclaration));

    await this.refilterDocumentsQueue.drain();
    await this.publish();
  }

  async refilterAndRecordDocument(documentDeclaration) {
    const { type, service } = documentDeclaration;

    const { id: snapshotId, content: snapshotContent, mimeType } = await history.getLatestSnapshot(
      service.id,
      type
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
    });
  }

  async _forEachDocumentOf(servicesIds = [], callback) {
    servicesIds.forEach((serviceId) => {
      this.services[serviceId].getDocumentTypes().forEach((documentType) => {
        callback(this.services[serviceId].getDocumentDeclaration(documentType));
      });
    });
  }

  async recordSnapshot({ content, mimeType, documentDeclaration: { service, type } }) {
    const { id: snapshotId, isFirstRecord } = await history.recordSnapshot({
      serviceId: service.id,
      documentType: type,
      content,
      mimeType,
    });

    if (!snapshotId) {
      return this.emit('snapshotNotChanged', service.id, type);
    }

    this.emit(
      isFirstRecord ? 'firstSnapshotRecorded' : 'snapshotRecorded',
      service.id,
      type,
      snapshotId
    );
    return snapshotId;
  }

  async recordVersion({
    snapshotContent,
    mimeType,
    snapshotId,
    documentDeclaration,
    isRefiltering,
  }) {
    const { service, type, contentSelectors, noiseSelectors, location } = documentDeclaration;
    try {
      const content = await filter({
        content: snapshotContent,
        mimeType,
        documentDeclaration,
      });

      const recordFunction = !isRefiltering ? 'recordVersion' : 'recordRefilter';

      const { id: versionId, isFirstRecord } = await history[recordFunction]({
        serviceId: service.id,
        content,
        documentType: type,
        snapshotId,
      });

      if (!versionId) {
        return this.emit('versionNotChanged', service.id, type);
      }

      this.emit(
        isFirstRecord ? 'firstVersionRecorded' : 'versionRecorded',
        service.id,
        type,
        versionId
      );
    } catch (e) {
      if (e instanceof InaccessibleContentError) {
        // send error with more info
        throw new InaccessibleContentError({
          contentSelectors,
          noiseSelectors,
          url: location,
          name: service.id,
          documentType: type,
          message: e.toString(),
        });
      }

      throw e;
    }
  }

  async publish() {
    if (!config.get('history.publish')) {
      return;
    }

    await history.publish();
    this.emit('recordsPublished');
  }
}
