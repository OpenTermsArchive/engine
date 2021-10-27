import async from 'async';
import config from 'config';
import events from 'events';

import * as github from '../github/index.js';
import * as history from './history/index.js';
import * as services from './services/index.js';
import { InaccessibleContentError } from './errors.js';
import fetch from './fetcher/index.js';
import filter from './filter/index.js';
import logger from '../logger/index.js';

const MAX_PARALLEL_DOCUMENTS_TRACKS = 1;
const MAX_PARALLEL_REFILTERS = 1;

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
    this.trackDocumentChangesQueue = async.queue(async documentDeclaration => this.trackDocumentChanges(documentDeclaration), MAX_PARALLEL_DOCUMENTS_TRACKS);
    this.refilterDocumentsQueue = async.queue(async documentDeclaration => this.refilterAndRecordDocument(documentDeclaration), MAX_PARALLEL_REFILTERS);

    const queueErrorHandler = createGithubError => async (
      error,
      { location, service, contentSelectors, noiseSelectors, type }
    ) => {
      if (error.toString().includes('HttpError: API rate limit exceeded for user ID')) {
        // This is an error due to SendInBlue quota, bypass
        return;
      }

      if (error instanceof InaccessibleContentError) {
        this.emit('inaccessibleContent', error, service.id, type);

        if (createGithubError) {
          const { title, body } = github.formatIssueTitleAndBody({
            contentSelectors,
            noiseSelectors,
            url: location,
            name: service.id,
            documentType: type,
            message: error.toString(),
          });

          await github.createIssueIfNotExist({
            title,
            body,
            labels: ['fix-document'],
            comment: '🤖 Reopened automatically as an error occured',
          });
        }

        return;
      }

      this.emit('error', error, service.id, type);

      throw error;
    };

    this.trackDocumentChangesQueue.error(queueErrorHandler(true));
    this.refilterDocumentsQueue.error(queueErrorHandler(false));
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
    this._forEachDocumentOf(servicesIds, documentDeclaration =>
      this.trackDocumentChangesQueue.push(documentDeclaration));

    await this.trackDocumentChangesQueue.drain();

    await this.publish();
  }

  async trackDocumentChanges(documentDeclaration) {
    const { location, executeClientScripts, headers, service, type } = documentDeclaration;

    const { mimeType, content } = await fetch({
      url: location,
      executeClientScripts,
      cssSelectors: documentDeclaration.getCssSelectors(),
      headers,
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

    const recordedVersion = await this.recordVersion({
      snapshotContent: content,
      mimeType,
      snapshotId,
      documentDeclaration,
    });

    await github.closeIssueIfExists({
      labels: ['fix-document'],
      title: `Fix ${service.id} - ${type}`,
      comment: '🤖 Closed automatically as data was gathered successfully',
    });

    return recordedVersion;
  }

  async refilterAndRecord(servicesIds) {
    this._forEachDocumentOf(servicesIds, documentDeclaration =>
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
    try {
      return await this.recordVersion({
        snapshotContent,
        mimeType,
        snapshotId,
        documentDeclaration,
        isRefiltering: true,
      });
    } catch (e) {
      if (e instanceof InaccessibleContentError) {
        logger.warn('In refiltering', e);

        // previous snapshot did not have the corresponding selectors
        // we can safely ignore this error as it will be fixed in next tracking change
        return null;
      }
      throw e;
    }
  }

  async _forEachDocumentOf(servicesIds = [], callback) {
    servicesIds.forEach(serviceId => {
      this.services[serviceId].getDocumentTypes().forEach(documentType => {
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
    const { service, type } = documentDeclaration;
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
  }

  async publish() {
    if (!config.get('history.publish')) {
      return;
    }

    await history.publish();
    this.emit('recordsPublished');
  }
}
