import * as github from '../github/index.js';
import * as history from './history/index.js';
import * as services from './services/index.js';

import { InaccessibleContentError } from './errors.js';
import async from 'async';
import config from 'config';
import events from 'events';
import fetch from './fetcher/index.js';
import filter from './filter/index.js';
import logger from '../logger/index.js';
import pTimeout from '@lolpants/ptimeout';

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

const LOCAL_CONTRIBUTE_URL = 'http://localhost:3000/contribute/service';
const CONTRIBUTE_URL = 'https://opentermsarchive.org/contribute/service';
const GITHUB_VERSIONS_URL = 'https://github.com/ambanum/OpenTermsArchive-versions/blob/master';
const GITHUB_REPO_URL = 'https://github.com/ambanum/OpenTermsArchive/blob/master/services';
const GOOGLE_URL = 'https://www.google.com/search?q=';

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

    const queueErrorHandler = (createError) => (error, messageOrObject) => {
      const { location, service, contentSelectors, noiseSelectors, type } = messageOrObject;

      if (error instanceof InaccessibleContentError) {
        if (!createError) {
          return this.emit('inaccessibleContent', error, service.id, type);
        }

        if (error.toString().includes('HttpError: API rate limit exceeded for user ID')) {
          // This is an error due to send in blue quota, bypass
          return;
        }

        // this is a promise and as error handler is not async
        // it might resolve
        return this.createError({
          contentSelectors,
          noiseSelectors,
          url: location,
          name: service.id,
          documentType: type,
          message: error.toString(),
        }).then(() => {
          // as queueErrorHandler is not async
          // we just use an empty callback
        });
      }

      this.emit('error', error, service.id, type);

      throw error;
    };

    this.trackDocumentChangesQueue.error(queueErrorHandler(true));
    this.refilterDocumentsQueue.error(queueErrorHandler(false));
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
    this._forEachDocumentOf(servicesIds, async (documentDeclaration) =>
      this.trackDocumentChangesQueue.push(documentDeclaration)
    );

    await this.trackDocumentChangesQueue.drain();

    await this.publish();
  }

  async trackDocumentChanges(documentDeclaration) {
    const {
      location,
      executeClientScripts,
      headers,
      service,
      contentSelectors,
      noiseSelectors,
      type,
    } = documentDeclaration;

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
      comment: `🤖 Closed automatically as data was gathered successfully`,
    });
    return recordedVersion;
  }

  async createError(messageOrObject) {
    const { message, contentSelectors, noiseSelectors, url, name, documentType } = messageOrObject;

    /* eslint-disable no-nested-ternary */
    const contentSelectorsAsArray = (typeof contentSelectors === 'string'
      ? contentSelectors.split(',')
      : Array.isArray(contentSelectors)
      ? contentSelectors
      : []
    ).map(encodeURIComponent);

    const noiseSelectorsAsArray = (typeof noiseSelectors === 'string'
      ? noiseSelectors.split(',')
      : Array.isArray(noiseSelectors)
      ? noiseSelectors
      : []
    ).map(encodeURIComponent);
    /* eslint-enable no-nested-ternary */

    const contentSelectorsQueryString = contentSelectorsAsArray.length
      ? `&selectedCss[]=${contentSelectorsAsArray.join('&selectedCss[]=')}`
      : '';
    const noiseSelectorsQueryString = noiseSelectorsAsArray.length
      ? `&removedCss[]=${noiseSelectorsAsArray.join('&removedCss[]=')}`
      : '';

    const encodedName = encodeURIComponent(name);
    const encodedType = encodeURIComponent(documentType);
    const encodedUrl = encodeURIComponent(url);

    const urlQueryParams = `step=2&url=${encodedUrl}&name=${encodedName}&documentType=${encodedType}${noiseSelectorsQueryString}${contentSelectorsQueryString}&expertMode=true`;

    const message404 = message.includes('404')
      ? `- Search Google to get the new url: ${GOOGLE_URL}%22${encodedName}%22+%22${encodedType}%22`
      : '';

    const title = `Fix ${name} - ${documentType}`;

    const body = `
This service is not available anymore.
Please fix it.

\`${message}\`

Here some ideas on how to fix this issue:
- See what's wrong online: ${CONTRIBUTE_URL}?${urlQueryParams}
- Or on your local: ${LOCAL_CONTRIBUTE_URL}?${urlQueryParams}
${message404}

And some info about what has already been tracked
- See all versions tracked here: ${GITHUB_VERSIONS_URL}/${encodedName}/${encodedType}.md
- See original JSON file: ${GITHUB_REPO_URL}/${encodedName}.json

Thanks
`;
    await github.createIssueIfNotExist({
      body,
      title,
      labels: ['fix-document'],
      comment: `🤖 Reopened automatically as an error occured`,
    });
  }

  async refilterAndRecord(servicesIds) {
    this._forEachDocumentOf(servicesIds, (documentDeclaration) =>
      this.refilterDocumentsQueue.push(documentDeclaration)
    );

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
