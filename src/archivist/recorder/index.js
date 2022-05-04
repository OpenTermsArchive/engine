export default class Recorder {
  constructor({ versionsStorageAdapter, snapshotsStorageAdapter }) {
    if (!versionsStorageAdapter || !snapshotsStorageAdapter) {
      throw new RangeError('Storage adapters should be defined both for versions and snapshots');
    }

    this.versionsStorageAdapter = versionsStorageAdapter;
    this.snapshotsStorageAdapter = snapshotsStorageAdapter;
  }

  async initialize() {
    return Promise.all([ this.versionsStorageAdapter.initialize(), this.snapshotsStorageAdapter.initialize() ]);
  }

  async finalize() {
    return Promise.all([ this.versionsStorageAdapter.finalize(), this.snapshotsStorageAdapter.finalize() ]);
  }

  async getLatestSnapshot(serviceId, documentType) {
    const record = await this.snapshotsStorageAdapter.getLatestRecord(serviceId, documentType);

    return {
      ...record,
      content: await record.content,
    };
  }

  async recordSnapshot({ serviceId, documentType, fetchDate, mimeType, content }) {
    if (!serviceId) {
      throw new Error('A service ID is required');
    }

    if (!documentType) {
      throw new Error('A document type is required');
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

    return this.snapshotsStorageAdapter.record({ serviceId, documentType, fetchDate, mimeType, content });
  }

  async recordVersion({ serviceId, documentType, snapshotId, fetchDate, mimeType, content, isRefilter }) {
    if (!serviceId) {
      throw new Error('A service ID is required');
    }

    if (!documentType) {
      throw new Error('A document type is required');
    }

    if (!snapshotId) {
      throw new Error(`A snapshot ID is required to ensure data consistency for ${serviceId}'s ${documentType}`);
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

    return this.versionsStorageAdapter.record({ serviceId, documentType, snapshotId, fetchDate, mimeType, content, isRefilter });
  }

  async recordRefilter(params) {
    return this.recordVersion({ isRefilter: true, ...params });
  }
}
