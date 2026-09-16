import path from 'path';

import GitRepository from './git/index.js';
import MongoRepository from './mongo/index.js';

export default class RepositoryFactory {
  static create(params, { readOnly = false } = {}) {
    switch (params.type) {
    case 'git':
      return new GitRepository({
        ...params.git,
        path: path.resolve(process.cwd(), params.git.path),
        readOnly,
      });
    case 'mongo':
      return new MongoRepository(params.mongo); // Initializing a Mongo repository only connects and ensures an index, which is harmless for readers
    default:
      throw new Error(`Unknown storage repository configuration for type '${params.type}'`);
    }
  }
}
