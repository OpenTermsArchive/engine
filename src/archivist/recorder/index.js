import mime from 'mime';

import Record from './record.js';
import RepositoryFactory from './repositories/factory.js';

export default class Recorder {
  constructor(config) {
    this.versionsRepository = RepositoryFactory.create(config.versions.storage);
    this.snapshotsRepository = RepositoryFactory.create(config.snapshots.storage);
  }

  async initialize() {
    return Promise.all([ this.versionsRepository.initialize(), this.snapshotsRepository.initialize() ]);
  }

  async finalize() {
    return Promise.all([ this.versionsRepository.finalize(), this.snapshotsRepository.finalize() ]);
  }

  async getLatestSnapshot(serviceId, termsType, pageId) {
    return this.snapshotsRepository.findLatest(serviceId, termsType, pageId);
  }

  async recordSnapshot({ serviceId, termsType, pageId, fetchDate, mimeType, content }) {
    if (!serviceId) {
      throw new Error('A service ID is required');
    }

    if (!termsType) {
      throw new Error('A terms type is required');
    }

    if (!fetchDate) {
      throw new Error('The fetch date of the snapshot is required to ensure data consistency');
    }

    if (!content) {
      throw new Error('A document content is required');
    }

    if (!mimeType) {
      throw new Error('A document mime type is required to ensure data consistency');
    }

    return this.snapshotsRepository.save(new Record({ serviceId, termsType, pageId, fetchDate, mimeType, content }));
  }

  async recordVersion({ serviceId, termsType, snapshotIds, fetchDate, content, extractOnly }) {
    if (!serviceId) {
      throw new Error('A service ID is required');
    }

    if (!termsType) {
      throw new Error('A terms type is required');
    }

    if (!snapshotIds?.length) {
      throw new Error(`At least one snapshot ID is required to ensure data consistency for ${serviceId}'s ${termsType}`);
    }

    if (!fetchDate) {
      throw new Error('The fetch date of the snapshot is required to ensure data consistency');
    }

    if (!content) {
      throw new Error('A document content is required');
    }

    const mimeType = mime.getType('markdown'); // A version is always in markdown format

    return this.versionsRepository.save(new Record({ serviceId, termsType, snapshotIds, fetchDate, mimeType, content, isRefilter: extractOnly }));
  }
}
