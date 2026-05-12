import config from 'config';
import express from 'express';
import helmet from 'helmet';

import { getCollection } from '../../archivist/collection/index.js';
import RepositoryFactory from '../../archivist/recorder/repositories/factory.js';
import * as Services from '../../archivist/services/index.js';

import docsRouter from './docs.js';
import feedRouter from './feed.js';
import metadataRouter from './metadata.js';
import servicesRouter from './services.js';
import versionsRouter from './versions.js';

export default async function apiRouter(basePath) {
  const router = express.Router();

  const defaultDirectives = helmet.contentSecurityPolicy.getDefaultDirectives();

  delete defaultDirectives['upgrade-insecure-requests'];

  router.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: defaultDirectives,
    },
  })); // Do not enable `upgrade-insecure-requests` directive set by Helmet for docs routes to ensure insecure requests won't be upgraded to secure requests for swaggerUI assets; see https://github.com/center-for-threat-informed-defense/attack-workbench-rest-api/issues/96#issuecomment-924193910 and https://github.com/scottie1984/swagger-ui-express/issues/212#issuecomment-825803088

  router.use(docsRouter(basePath));

  router.use(helmet()); // then, enable all `helmet` HTTP response headers for all others routes

  router.get('/', (req, res) => {
    res.json({ message: 'Welcome to an instance of the Open Terms Archive API. Documentation is available at /docs. Learn more on Open Terms Archive on https://opentermsarchive.org.' });
  });

  const services = await Services.load();
  const collection = await getCollection();
  const versionsStorageConfig = config.get('@opentermsarchive/engine.recorder.versions.storage');
  const versionsRepository = await RepositoryFactory.create(versionsStorageConfig).initialize();
  const feedConfig = config.get('@opentermsarchive/engine.collection-api.feed');

  if (!collection.metadata?.id) {
    throw new Error('Collection metadata "id" is required to expose feed endpoints, as it is used to build the tag URIs that uniquely identify the feed and its entries. Add an "id" field to the collection metadata file.');
  }

  if (!collection.metadata?.name) {
    throw new Error('Collection metadata "name" is required to expose feed endpoints, as it is used as the Atom feed title which the Atom 1.0 specification requires to be non-empty. Add a "name" field to the collection metadata file.');
  }

  router.use(await metadataRouter(collection, services));
  router.use(servicesRouter(services));
  router.use(versionsRouter(versionsRepository));
  router.use(feedRouter(services, versionsRepository, versionsStorageConfig.type, feedConfig.limit, feedConfig.versionUrlTemplate));

  return router;
}
