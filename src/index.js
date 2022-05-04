import path from 'path';
import { fileURLToPath } from 'url';

import config from 'config';

import GitAdapter from './storage-adapters/git/index.js';
import MongoAdapter from './storage-adapters/mongo/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function instantiateVersionsStorageAdapter() {
  return instantiateStorageAdapter('versions');
}

export function instantiateSnapshotsStorageAdapter() {
  return instantiateStorageAdapter('snapshots');
}

function instantiateStorageAdapter(recordType) {
  let result;

  switch (config.get(`recorder.${recordType}.storage.type`)) {
  case 'git':
    result = new GitAdapter({
      ...config.get(`recorder.${recordType}.storage.git`),
      path: path.resolve(__dirname, '../', config.get(`recorder.${recordType}.storage.git.path`)),
    });
    break;
  case 'mongo':
    result = new MongoAdapter(config.get(`recorder.${recordType}.storage.mongo`));
    break;
  default:
    throw new Error(`No configuration found for ${recordType} storage adapter`);
  }

  return result;
}
