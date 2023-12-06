import config from 'config';
import express from 'express';

import 'express-async-errors';
import logger from './logger.js';
import errorsMiddleware from './middlewares/errors.js';
import loggerMiddleware from './middlewares/logger.js';
import apiRouter from './routes/index.js';

const app = express();

if (process.env.NODE_ENV !== 'test') {
  app.use(loggerMiddleware);
}

const BASE_PATH = `${config.get('api.basePath')}/v1`;

app.use(BASE_PATH, apiRouter(BASE_PATH));
app.use(errorsMiddleware);

const port = config.get('api.port');

app.listen(port);

if (process.env.NODE_ENV !== 'test') {
  logger.info(`Start Open Terms Archive API on http://localhost:${port}\n`);
}

export default app;
