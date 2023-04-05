import config from 'config';
import express from 'express';
import helmet from 'helmet';
import swaggerJsdoc from 'swagger-jsdoc';

import logger from './logger.js';

const __dirname = new URL('.', import.meta.url).pathname;

const app = express();

app.use(helmet());

app.get('/specs', (req, res) => {
  res.json(swaggerJsdoc({
    definition: {
      swagger: '2.0',
      openapi: '3.1.0',
      info: {
        title: 'Open Terms Archive API',
        version: '0.1.0',
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

app.listen(config.get('api.port'));

logger.info('Start Open Terms Archive Collection metadata API\n');
