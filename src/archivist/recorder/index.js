import RepositoryFactory from './repositories/factory.js';
import Snapshot from './snapshot.js';
import Version from './version.js';

export default class Recorder {
  constructor(config) {
    this.versionsRepository = RepositoryFactory.create(config.versions.storage);
    this.snapshotsRepository = RepositoryFactory.create(config.snapshots.storage);
  }

  initialize() {
    return Promise.all([ this.versionsRepository.initialize(), this.snapshotsRepository.initialize() ]);
  }

  async finalize() {
    // Close repositories sequentially to avoid race conditions when both repositories  use the same MongoDB connection (same server/database).
    // Parallel closing can cause "Operation interrupted because client was closed" errors, especially on Windows.
    await this.versionsRepository.finalize();
    await this.snapshotsRepository.finalize();
  }

  getLatestSnapshot(terms, sourceDocumentId) {
    return this.snapshotsRepository.findLatest(terms.service.id, terms.type, terms.hasMultipleSourceDocuments && sourceDocumentId);
  }

  record(record) {
    record.validate();

    switch (record.constructor) { // eslint-disable-line default-case
    case Version:
      return this.versionsRepository.save(record);
    case Snapshot:
      return this.snapshotsRepository.save(record);
    }
  }
}
