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

  async getLatestSnapshot(terms, sourceDocumentId) {
    return this.snapshotsRepository.findLatest(terms.service.id, terms.type, terms.hasMultipleSourceDocuments && sourceDocumentId);
  }

  async recordVersion(record) {
    record.validate();

    return this.versionsRepository.save(record);
  }

  async recordSnapshot(record) {
    record.validate();

    return this.snapshotsRepository.save(record);
  }
}
