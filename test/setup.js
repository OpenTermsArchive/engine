import config from 'config';

import RepositoryFactory from '../src/archivist/recorder/repositories/factory.js';

// The Collection API opens the repositories read-only as soon as its server module is imported, which happens when Mocha loads the test files, so the repositories have to exist before that
await Promise.all([ 'versions', 'snapshots' ].map(async recordType => {
  const repository = await RepositoryFactory.create(config.get(`@opentermsarchive/engine.recorder.${recordType}.storage`)).initialize();

  return repository.finalize();
}));
