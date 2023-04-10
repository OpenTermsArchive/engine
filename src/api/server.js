import config from 'config';
import express from 'express';
import helmet from 'helmet';
import swaggerJsdoc from 'swagger-jsdoc';

import Archivist from '../archivist/index.js';

import logger from './logger.js';
import servicesRouter from './routes/services.js';

const apiRouter = express.Router();
const __dirname = new URL('.', import.meta.url).pathname;

apiRouter.get('/specs', (req, res) => {
  res.json(swaggerJsdoc({
    definition: {
      swagger: '2.0',
      openapi: '3.1.0',
      info: {
        title: 'Open Terms Archive API',
        version: '1.0.0',
        description: 'Collection API of Open Terms Archive',
        license: {
          name: 'EUPL-1.2',
          url: 'https://eupl.eu/1.2/',
        },
      },
    },
    apis: [`${__dirname}/routes/*.js`],
  }));
});

const archivist = await new Archivist({ recorderConfig: config.get('recorder') }).initialize();

apiRouter.use('/services', servicesRouter(archivist.services));

const app = express();

app.use(helmet());
app.use(`${config.get('api.basePath')}/v1`, apiRouter);
app.listen(config.get('api.port'));

logger.info('Start Open Terms Archive collection metadata API\n');

export default app;
