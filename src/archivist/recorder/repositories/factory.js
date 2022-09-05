import path from 'path';

import GitRepository from './git/index.js';
import MongoRepository from './mongo/index.js';

export default class RepositoryFactory {
  /**
   * @param {Object} storageConfig   A configuration object describing which repository type should be created from the `config.recorder.$recordType.storage` configuration.
   * @returns {RepositoryInterface}
   */
  static create(storageConfig) {
    switch (storageConfig.type) {
    case 'git':
      return new GitRepository({
        ...storageConfig.git,
        path: path.resolve(process.cwd(), storageConfig.git.path),
      });
    case 'mongo':
      return new MongoRepository(storageConfig.mongo);
    default:
      throw new Error(`Unknown storage repository configuration for type '${storageConfig.type}'`);
    }
  }
}
