import express from 'express';
import helmet from 'helmet';

import { getCollection } from '../../archivist/collection/index.js';
import * as Services from '../../archivist/services/index.js';

import docsRouter from './docs.js';
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

  router.use(await metadataRouter(collection, services));
  router.use(servicesRouter(services));
  router.use(versionsRouter);

  return router;
}
