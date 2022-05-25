import path from 'path';
import { fileURLToPath } from 'url';

import config from 'config';

import GitAdapter from '../../src/storage-adapters/git/index.js';

import logger from './logger/index.js';
import { importReadme } from './utils/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = path.resolve(__dirname, '../../');

(async function main() {
  console.time('Total time');

  const versionsAdapter = new GitAdapter({
    ...config.get('recorder.versions.storage.git'),
    path: path.resolve(ROOT_PATH, './data/france-elections-versions'),
  });

  const versionsTargetAdapter = new GitAdapter({
    ...config.get('recorder.versions.storage.git'),
    prefixMessageToSnapshotId: 'This version was recorded after filtering snapshot https://github.com/OpenTermsArchive/france-elections-snapshots/commit/',
    path: path.resolve(ROOT_PATH, './data/france-elections-versions-hash-updated-test'),
  });

  const snapshotsAdapter = new GitAdapter({
    ...config.get('recorder.snapshots.storage.git'),
    path: path.resolve(ROOT_PATH, './data/france-elections-snapshots'),
  });

  await versionsAdapter.initialize();
  await versionsTargetAdapter.initialize();
  await snapshotsAdapter.initialize();

  await importReadme({ from: versionsAdapter, to: versionsTargetAdapter });

  const total = await versionsAdapter.count();
  let current = 1;

  for await (const record of versionsAdapter.iterate()) {
    const fullSnapshotId = await snapshotsAdapter.git.getFullHash(record.snapshotId);

    const { id: recordId } = await versionsTargetAdapter.record({ ...record, snapshotId: fullSnapshotId });

    if (!recordId) {
      logger.warn({ message: 'Record skipped', serviceId: record.serviceId, type: record.documentType, id: record.id, current, total });
    } else {
      logger.info({ message: `Update short sha ${record.snapshotId} to ${fullSnapshotId}`, serviceId: record.serviceId, type: record.documentType, id: record.id, current, total });
    }

    current++;
  }

  await versionsAdapter.finalize();
  await versionsTargetAdapter.finalize();
  await snapshotsAdapter.finalize();
}());
