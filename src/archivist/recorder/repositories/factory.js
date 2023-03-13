import path from 'path';

import Snapshot from '../snapshot.js';
import Version from '../version.js';

import GitRepository from './git/index.js';
import MongoRepository from './mongo/index.js';

export default class RepositoryFactory {
  static #create(recordType, params) {
    switch (params.type) {
    case 'git':
      return new GitRepository(recordType, {
        ...params.git,
        path: path.resolve(process.cwd(), params.git.path),
      });
    case 'mongo':
      return new MongoRepository(recordType, params.mongo);
    default:
      throw new Error(`Unknown storage repository configuration for type '${params.type}'`);
    }
  }

  static createVersionRepository(params) {
    return RepositoryFactory.#create(Version, params);
  }

  static createSnapshotRepository(params) {
    return RepositoryFactory.#create(Snapshot, params);
  }
}
