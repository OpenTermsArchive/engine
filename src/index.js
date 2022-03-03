import path from 'path';
import { fileURLToPath } from 'url';

import config from 'config';

import GitAdapter from './storage-adapters/git/index.js';
import MongoAdapter from './storage-adapters/mongo/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function instantiateVersionsStorageAdapter() {
  return instantiateStorageAdapter('versions', 'md');
}

export function instantiateSnapshotsStorageAdapter() {
  return instantiateStorageAdapter('snapshots', 'html');
}

function instantiateStorageAdapter(recordType, fileExtension) {
  let storageAdapter;

  switch (config.get(`recorder.${recordType}.storage.type`)) {
  case 'git':
    storageAdapter = new GitAdapter({
      ...config.get(`recorder.${recordType}.storage.git`),
      path: path.resolve(__dirname, '../', config.get(`recorder.${recordType}.storage.git.path`)),
      fileExtension,
    });
    break;
  case 'mongo':
    storageAdapter = new MongoAdapter(config.get(`recorder.${recordType}.storage.mongo`));
    break;
  default:
    throw new Error('No config were found for snapshots storage adapter');
  }

  return storageAdapter;
}
