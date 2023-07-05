import config from 'config';
import express from 'express';

import logger from './logger.js';
import errorsMiddleware from './middlewares/errors.js';
import loggerMiddleware from './middlewares/logger.js';
import apiRouter from './routes/index.js';

const app = express();

if (process.env.NODE_ENV !== 'test') {
  app.use(loggerMiddleware);
}

app.use(`${config.get('api.basePath')}/v1`, apiRouter);
app.use(errorsMiddleware);

app.listen(config.get('api.port'));
logger.info('Start Open Terms Archive API\n');

export default app;
