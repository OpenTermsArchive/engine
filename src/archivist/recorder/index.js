import RepositoryFactory from './repositories/factory.js';
import Snapshot from './snapshot.js';
import Version from './version.js';

export default class Recorder {
  constructor(config) {
    this.versionsRepository = RepositoryFactory.createVersionRepository(config.versions.storage);
    this.snapshotsRepository = RepositoryFactory.createSnapshotRepository(config.snapshots.storage);
  }

  async initialize() {
    return Promise.all([ this.versionsRepository.initialize(), this.snapshotsRepository.initialize() ]);
  }

  async finalize() {
    return Promise.all([ this.versionsRepository.finalize(), this.snapshotsRepository.finalize() ]);
  }

  async getLatestSnapshot(terms, sourceDocumentId) {
    return this.snapshotsRepository.findLatest(terms.service.id, terms.type, terms.hasMultipleSourceDocuments && sourceDocumentId);
  }

  async record(record) {
    record.validate();

    switch (record.constructor) { // eslint-disable-line default-case
    case Version:
      return this.versionsRepository.save(record);
    case Snapshot:
      return this.snapshotsRepository.save(record);
    }
  }
}
