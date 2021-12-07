export default class Recorder {
  constructor({ versionsStorageAdapter, snapshotsStorageAdapter }) {
    if (!versionsStorageAdapter && !snapshotsStorageAdapter) {
      throw new RangeError('storage adapters should be defined both for versions and snapshots');
    }

    this.versionsStorageAdapter = versionsStorageAdapter;
    this.snapshotsStorageAdapter = snapshotsStorageAdapter;
  }

  async initialize() {
    return Promise.all([ this.versionsStorageAdapter, this.snapshotsStorageAdapter ].map(storageAdapter => {
      if (typeof storageAdapter.initialize != 'function') {
        return Promise.resolve();
      }

      return storageAdapter.initialize();
    }));
  }

  async finalize() {
    return Promise.all([ this.versionsStorageAdapter, this.snapshotsStorageAdapter ].map(storageAdapter => {
      if (typeof storageAdapter.finalize != 'function') {
        return Promise.resolve();
      }

      return storageAdapter.finalize();
    }));
  }

  async getLatestSnapshot(serviceId, documentType) {
    return this.snapshotsStorageAdapter.getLatestRecord(serviceId, documentType);
  }

  async recordSnapshot(options) {
    return this.snapshotsStorageAdapter.record(options);
  }

  async recordVersion({ snapshotId, serviceId, documentType, ...options }) {
    if (!snapshotId) {
      throw new Error(`A snapshot ID is required to ensure data consistency for ${serviceId}'s ${documentType}`);
    }

    return this.versionsStorageAdapter.record({ snapshotId, serviceId, documentType, ...options });
  }

  async recordRefilter({ snapshotId, serviceId, documentType, ...options }) {
    if (!snapshotId) {
      throw new Error(`A snapshot ID is required to ensure data consistency for ${serviceId}'s ${documentType}`);
    }

    return this.versionsStorageAdapter.record({ snapshotId, serviceId, documentType, isRefilter: true, ...options });
  }
}
