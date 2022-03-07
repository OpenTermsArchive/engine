import path from 'path';
import { fileURLToPath } from 'url';

import config from 'config';

import GitAdapter from './storage-adapters/git/index.js';
import MongoAdapter from './storage-adapters/mongo/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function instantiateVersionsStorageAdapter() {
  let versionsStorageAdapter;

  if (config.has('recorder.versions.storage.git')) {
    versionsStorageAdapter = new GitAdapter({
      ...config.get('recorder.versions.storage.git'),
      path: path.resolve(__dirname, '../', config.get('recorder.versions.storage.git.path')),
      fileExtension: 'md',
    });
  } else if (config.has('recorder.versions.storage.mongo')) {
    versionsStorageAdapter = new MongoAdapter(config.get('recorder.versions.storage.mongo'));
  } else {
    throw new Error('No config were found for versions storage adapter');
  }

  return versionsStorageAdapter;
}

export function instantiateSnapshotsStorageAdapter() {
  let snapshotsStorageAdapter;

  if (config.has('recorder.snapshots.storage.git')) {
    snapshotsStorageAdapter = new GitAdapter({
      ...config.get('recorder.snapshots.storage.git'),
      path: path.resolve(__dirname, '../', config.get('recorder.snapshots.storage.git.path')),
      fileExtension: 'html',
    });
  } else if (config.has('recorder.snapshots.storage.mongo')) {
    snapshotsStorageAdapter = new MongoAdapter(config.get('recorder.snapshots.storage.mongo'));
  } else {
    throw new Error('No config were found for snapshots storage adapter');
  }

  return snapshotsStorageAdapter;
}
