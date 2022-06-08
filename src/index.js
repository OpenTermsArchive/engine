import path from 'path';
import { fileURLToPath } from 'url';

import config from 'config';

import GitRepository from './archivist/recorder/repositories/git/index.js';
import MongoRepository from './archivist/recorder/repositories/mongo/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function instantiateVersionsRepository() {
  return instantiateRepository('versions');
}

export function instantiateSnapshotsRepository() {
  return instantiateRepository('snapshots');
}

function instantiateRepository(recordType) {
  let result;

  switch (config.get(`recorder.${recordType}.storage.type`)) {
  case 'git':
    result = new GitRepository({
      ...config.get(`recorder.${recordType}.storage.git`),
      path: path.resolve(__dirname, '../', config.get(`recorder.${recordType}.storage.git.path`)),
    });
    break;
  case 'mongo':
    result = new MongoRepository(config.get(`recorder.${recordType}.storage.mongo`));
    break;
  default:
    throw new Error(`No configuration found for ${recordType} storage repository`);
  }

  return result;
}
