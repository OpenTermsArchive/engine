import path from 'path';
import { fileURLToPath } from 'url';

import GitRepository from './git/index.js';
import MongoRepository from './mongo/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class RepositoryFactory {
  static create(params) {
    switch (params.type) {
    case 'git':
      return new GitRepository({
        ...params.git,
        path: path.resolve(__dirname, '../../../../', params.git.path),
      });
    case 'mongo':
      return new MongoRepository(params.mongo);
    default:
      throw new Error(`Unknow storage repository configuration with type: ${params.type}`);
    }
  }
}
