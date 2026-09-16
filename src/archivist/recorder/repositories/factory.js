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
      return new MongoRepository({ ...params.mongo, readOnly });
    default:
      throw new Error(`Unknown storage repository configuration for type '${params.type}'`);
    }
  }
}
