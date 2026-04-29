import config from 'config';

import RepositoryFactory from '../../archivist/recorder/repositories/factory.js';

export const storageConfig = config.get('@opentermsarchive/engine.recorder.versions.storage');

const versionsRepository = await RepositoryFactory.create(storageConfig).initialize();

export default versionsRepository;
