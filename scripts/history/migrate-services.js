import fsApi from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import config from 'config';
import winston from 'winston';

import GitRepository from '../../src/archivist/recorder/repositories/git/index.js';

import { format } from './logger/index.js';
import { importReadmeInGit } from './utils/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = path.resolve(__dirname, '../../');
const fs = fsApi.promises;

const CONFIG = {
  servicesToMigrate: [ 'ASICS', 'Amazon', 'Orange Money France' ],
  from: {
    snapshots: 'france-snapshots',
    versions: 'france-versions-hash-updated',
    prefixMessageToSnapshotId: 'This version was recorded after filtering snapshot https://github.com/OpenTermsArchive/france-snapshots/commit/',
  },
  to: {
    snapshots: 'france-elections-snapshots',
    versions: 'france-elections-versions-hash-updated',
    prefixMessageToSnapshotId: 'This version was recorded after filtering snapshot https://github.com/OpenTermsArchive/france-elections-snapshots/commit/',
  },
};

const counters = {
  migrated: 0,
  skipped: 0,
};

(async function main() {
  console.time('Total time');

  const migration = {
    services: CONFIG.servicesToMigrate,
    from: {
      snapshots: {
        source: new GitRepository({
          ...config.get('recorder.snapshots.storage.git'),
          path: path.resolve(ROOT_PATH, `./data/${CONFIG.from.snapshots}`),
        }),
        destination: new GitRepository({
          ...config.get('recorder.snapshots.storage.git'),
          path: path.resolve(ROOT_PATH, `./data/${CONFIG.from.snapshots}-migrated`),
        }),
        logger: winston.createLogger({ transports: [ new (winston.transports.File)({ filename: `${__dirname}/logs/${CONFIG.from.snapshots}.log` }), new winston.transports.Console() ], format }),
      },
      versions: {
        source: new GitRepository({
          ...config.get('recorder.versions.storage.git'),
          path: path.resolve(ROOT_PATH, `./data/${CONFIG.from.versions}`),
        }),
        destination: new GitRepository({
          ...config.get('recorder.versions.storage.git'),
          path: path.resolve(ROOT_PATH, `./data/${CONFIG.from.versions}-migrated`),
          prefixMessageToSnapshotId: CONFIG.from.prefixMessageToSnapshotId,
        }),
        logger: winston.createLogger({ transports: [ new (winston.transports.File)({ filename: `${__dirname}/logs/${CONFIG.from.versions}.log` }), new winston.transports.Console() ], format }),
      },
    },
    to: {
      snapshots: {
        source: new GitRepository({
          ...config.get('recorder.snapshots.storage.git'),
          path: path.resolve(ROOT_PATH, `./data/${CONFIG.to.snapshots}`),
        }),
        destination: new GitRepository({
          ...config.get('recorder.snapshots.storage.git'),
          path: path.resolve(ROOT_PATH, `./data/${CONFIG.to.snapshots}-migrated`),
        }),
        logger: winston.createLogger({ transports: [ new (winston.transports.File)({ filename: `${__dirname}/logs/${CONFIG.to.snapshots}.log` }), new winston.transports.Console() ], format }),
      },
      versions: {
        source: new GitRepository({
          ...config.get('recorder.versions.storage.git'),
          path: path.resolve(ROOT_PATH, `./data/${CONFIG.to.versions}`),
        }),
        destination: new GitRepository({
          ...config.get('recorder.versions.storage.git'),
          path: path.resolve(ROOT_PATH, `./data/${CONFIG.to.versions}-migrated`),
          prefixMessageToSnapshotId: CONFIG.to.prefixMessageToSnapshotId,
        }),
        logger: winston.createLogger({ transports: [ new (winston.transports.File)({ filename: `${__dirname}/logs/${CONFIG.to.versions}.log` }), new winston.transports.Console() ], format }),
      },
    },
  };

  await initialize(migration);

  const fromSnapshotsRecords = await migration.from.snapshots.source.findAll();
  const toSnapshotsRecords = await migration.to.snapshots.source.findAll();
  const snapshotsToMigrate = fromSnapshotsRecords.filter(({ serviceId }) => migration.services.includes(serviceId));
  const fromSnapshotsRecordsToRewrite = fromSnapshotsRecords.filter(({ serviceId }) => !migration.services.includes(serviceId));
  const toSnapshotsRecordsMigrated = [ ...toSnapshotsRecords, ...snapshotsToMigrate ].sort((recordA, recordB) => new Date(recordA.fetchDate) - new Date(recordB.fetchDate));

  const fromVersionsRecords = await migration.from.versions.source.findAll();
  const toVersionsRecords = await migration.to.versions.source.findAll();
  const versionsToMigrate = fromVersionsRecords.filter(({ serviceId }) => migration.services.includes(serviceId));
  const fromVersionsRecordsToRewrite = fromVersionsRecords.filter(({ serviceId }) => !migration.services.includes(serviceId));
  const toVersionsRecordsMigrated = [ ...toVersionsRecords, ...versionsToMigrate ].sort((recordA, recordB) => new Date(recordA.fetchDate) - new Date(recordB.fetchDate));

  console.log('Number of snapshots in the source', fromSnapshotsRecords.length);
  console.log('Number of snapshots in the target', toSnapshotsRecords.length);
  console.log('Number of snapshots to migrate', snapshotsToMigrate.length);

  console.log('Number of versions in the source', fromVersionsRecords.length);
  console.log('Number of versions in the target', toVersionsRecords.length);
  console.log('Number of versions to migrate', versionsToMigrate.length);

  const idsMapping = {};

  await Promise.all([
    rewriteSnapshots(migration.from.snapshots.destination, fromSnapshotsRecordsToRewrite, idsMapping, migration.from.snapshots.logger),
    rewriteSnapshots(migration.to.snapshots.destination, toSnapshotsRecordsMigrated, idsMapping, migration.to.snapshots.logger),
  ]);

  await fs.writeFile(path.join(__dirname, 'ids-mapping.json'), JSON.stringify(idsMapping, null, 4));

  console.log('Snapshots migrated\n');

  await Promise.all([
    rewriteVersions(migration.from.versions.destination, fromVersionsRecordsToRewrite, idsMapping, migration.from.versions.logger),
    rewriteVersions(migration.to.versions.destination, toVersionsRecordsMigrated, idsMapping, migration.to.versions.logger),
  ]);

  console.log(`Records treated: ${Object.values(counters).reduce((acc, value) => acc + value, 0)}`);
  console.log(`⌙ Migrated records: ${counters.migrated}`);
  console.log(`⌙ Skipped records: ${counters.skipped}`);
  console.timeEnd('Total time');

  await finalize(migration);
}());

async function rewriteSnapshots(repository, records, idsMapping, logger) {
  let i = 1;

  for (const record of records) {
    const { id: recordId } = await repository.save(record); // eslint-disable-line no-await-in-loop

    idsMapping[record.id] = recordId; // Saves the mapping between the old ID and the new one.

    if (recordId) {
      logger.info({ message: `Migrated snapshot with new ID: ${recordId}`, serviceId: record.serviceId, type: record.termsType, id: record.id, current: i++, total: records.length });
      counters.migrated++;
    } else {
      logger.info({ message: 'Skipped snapshot', serviceId: record.serviceId, type: record.termsType, id: record.id, current: i++, total: records.length });
      counters.skipped++;
    }
  }
}

async function rewriteVersions(repository, records, idsMapping, logger) {
  let i = 1;

  for (const record of records) {
    const newSnapshotId = idsMapping[record.snapshotId];

    if (!newSnapshotId) {
      throw new Error(`Snapshot ID ${record.snapshotId} not found for record ${record.id}`);
    }

    record.snapshotId = newSnapshotId;

    const { id: recordId } = await repository.save(record); // eslint-disable-line no-await-in-loop

    if (recordId) {
      logger.info({ message: `Migrated version with new ID: ${recordId}`, serviceId: record.serviceId, type: record.termsType, id: record.id, current: i++, total: records.length });
      counters.migrated++;
    } else {
      logger.info({ message: 'Skipped version', serviceId: record.serviceId, type: record.termsType, id: record.id, current: i++, total: records.length });
      counters.skipped++;
    }
  }
}

async function initialize(migration) {
  await Promise.all([
    migration.from.snapshots.source.initialize(),
    migration.from.snapshots.destination.initialize(),
    migration.from.versions.source.initialize(),
    migration.from.versions.destination.initialize(),
    migration.to.snapshots.source.initialize(),
    migration.to.snapshots.destination.initialize(),
    migration.to.versions.source.initialize(),
    migration.to.versions.destination.initialize(),
  ]);

  return Promise.all([
    importReadmeInGit({ from: migration.from.snapshots.source, to: migration.from.snapshots.destination }),
    importReadmeInGit({ from: migration.from.versions.source, to: migration.from.versions.destination }),
    importReadmeInGit({ from: migration.to.snapshots.source, to: migration.to.snapshots.destination }),
    importReadmeInGit({ from: migration.to.versions.source, to: migration.to.versions.destination }),
  ]);
}

async function finalize(migration) {
  return Promise.all([
    migration.from.snapshots.source.finalize(),
    migration.from.snapshots.destination.finalize(),
    migration.from.versions.source.finalize(),
    migration.from.versions.destination.finalize(),
    migration.to.snapshots.source.finalize(),
    migration.to.snapshots.destination.finalize(),
    migration.to.versions.source.finalize(),
    migration.to.versions.destination.finalize(),
  ]);
}
