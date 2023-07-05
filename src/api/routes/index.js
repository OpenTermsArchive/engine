import path from 'path';
import { fileURLToPath } from 'url';

import express from 'express';
import helmet from 'helmet';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import servicesRouter from './services.js';
import specsRouter from './specs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function apiRouter(basePath) {
  const specs = swaggerJsdoc({
    definition: {
      openapi: '3.1.0',
      info: {
        title: 'Open Terms Archive API',
        version: '1.0.0',
        license: {
          name: 'EUPL-1.2',
          url: 'https://eupl.eu/1.2/',
        },
      },
      servers: [{ url: basePath }],
    },
    apis: [`${__dirname}/*.js`],
  });

  const apiRouter = express.Router();

  apiRouter.use('/', swaggerUi.serve);
  apiRouter.get('/', swaggerUi.setup(specs));

  apiRouter.use(helmet()); // Register `helmet` after swaggerUi routes to ensure insecure requests won't be upgraded to secure requests for swaggerUI assets; see https://github.com/scottie1984/swagger-ui-express/issues/212#issuecomment-825803088

  apiRouter.use('/specs', specsRouter(specs));
  apiRouter.use('/services', servicesRouter);

  return apiRouter;
}
