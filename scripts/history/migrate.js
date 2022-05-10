import path from 'path';
import { fileURLToPath } from 'url';

import config from 'config';
import { Low, JSONFile } from 'lowdb';

import GitAdapter from '../../src/storage-adapters/git/index.js';
import MongoAdapter from '../../src/storage-adapters/mongo/index.js';

import readme from './assets/README.template.js';
import logger from './logger/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = path.resolve(__dirname, '../../');

const COUNTERS = {
  imported: 0,
  skipped: 0,
};

(async function main() {
  console.time('Total time');

  const file = path.join(__dirname, 'ids-mapping.json');
  const adapter = new JSONFile(file);
  const db = new Low(adapter);

  await db.read();
  db.data = db.data || {};

  const sourceAdapter = new GitAdapter({
    ...config.get('recorder.snapshots.storage.git'),
    path: path.resolve(ROOT_PATH, './data/snapshots'),
  });

  const targetAdpater = new MongoAdapter({
    ...config.get('recorder.snapshots.storage.mongo'),
    database: 'open-terms-archive-migrate',
    collection: 'snapshots',
  });

  const targetAdpaterOptions = {};

  if (targetAdpater instanceof GitAdapter) {
    targetAdpaterOptions.readme = readme({ name: 'snapshots' });
  }

  await sourceAdapter.initialize();
  await targetAdpater.initialize(targetAdpaterOptions);

  const numberOfRecords = await sourceAdapter.count();

  let i = 1;

  for await (const record of sourceAdapter.iterate()) {
    const { id: recordId } = await targetAdpater.record(record);

    db.data[record.id] = recordId; // Saves the mapping between the old ID and the new one.

    if (recordId) {
      logger.info({ message: `Imported with new ID: ${recordId}`, serviceId: record.serviceId, type: record.documentType, id: record.id, current: i, total: numberOfRecords });
      COUNTERS.imported++;
    } else {
      logger.warn({ message: 'Skipped', serviceId: record.serviceId, type: record.documentType, id: record.id, current: i, total: numberOfRecords });
      COUNTERS.skipped++;
    }

    i++;
  }

  console.log(`Records treated: ${Object.values(COUNTERS).reduce((acc, value) => acc + value, 0)}`);
  console.log(`⌙ Imported records: ${COUNTERS.imported}`);
  console.log(`⌙ Skipped records: ${COUNTERS.skipped}`);
  console.timeEnd('Total time');

  await db.write();

  await sourceAdapter.finalize();
  await targetAdpater.finalize();
}());
