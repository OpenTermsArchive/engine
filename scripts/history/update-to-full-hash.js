import path from 'path';
import { fileURLToPath } from 'url';

import config from 'config';

import GitRepository from '../../src/archivist/recorder/repositories/git/index.js';

import logger from './logger/index.js';
import { importReadmeInGit } from './utils/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = path.resolve(__dirname, '../../');

(async function main() {
  console.time('Total time');

  const versionsRepository = new GitRepository({
    ...config.get('@opentermsarchive/engine.recorder.versions.storage.git'),
    path: path.resolve(ROOT_PATH, './data/france-elections-versions'),
  });

  const versionsTargetRepository = new GitRepository({
    ...config.get('@opentermsarchive/engine.recorder.versions.storage.git'),
    prefixMessageToSnapshotId: 'This version was recorded after filtering snapshot https://github.com/OpenTermsArchive/france-elections-snapshots/commit/',
    path: path.resolve(ROOT_PATH, './data/france-elections-versions-hash-updated-test'),
  });

  const snapshotsRepository = new GitRepository({
    ...config.get('@opentermsarchive/engine.recorder.snapshots.storage.git'),
    path: path.resolve(ROOT_PATH, './data/france-elections-snapshots'),
  });

  await versionsRepository.initialize();
  await versionsTargetRepository.initialize();
  await snapshotsRepository.initialize();

  await importReadmeInGit({ from: versionsRepository, to: versionsTargetRepository });

  const total = await versionsRepository.count();
  let current = 1;

  for await (const record of versionsRepository.iterate()) {
    const fullSnapshotId = await snapshotsRepository.git.getFullHash(record.snapshotId);

    record.snapshotId = fullSnapshotId;

    const { id: recordId } = await versionsTargetRepository.save(record);

    if (!recordId) {
      logger.warn({ message: 'Record skipped', serviceId: record.serviceId, type: record.termsType, id: record.id, current, total });
    } else {
      logger.info({ message: `Update short sha ${record.snapshotId} to ${fullSnapshotId}`, serviceId: record.serviceId, type: record.termsType, id: record.id, current, total });
    }

    current++;
  }

  await versionsRepository.finalize();
  await versionsTargetRepository.finalize();
  await snapshotsRepository.finalize();
}());
