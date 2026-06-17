import config from 'config';
import express from 'express';

import logger from './logger.js';
import errorsMiddleware from './middlewares/errors.js';
import loggerMiddleware from './middlewares/logger.js';
import apiRouter from './routes/index.js';

const app = express();

app.set('trust proxy', 'loopback'); // The API binds to 127.0.0.1 and is expected to run behind a reverse proxy. Honour X-Forwarded-* headers only when they come from a local proxy so absolute URLs emitted by routes (notably Atom feed links) reflect the URL seen by clients rather than the internal http://127.0.0.1 hop.

if (process.env.NODE_ENV !== 'test') {
  app.use(loggerMiddleware);
}

const BASE_PATH = `/${config.get('@opentermsarchive/engine.collection-api.basePath')}/v1`.replace(/\/\/+/g, '/'); // ensure there are no double slashes

app.use(BASE_PATH, await apiRouter(BASE_PATH));
app.use(errorsMiddleware);

const port = config.get('@opentermsarchive/engine.collection-api.port');

app.listen(port, '127.0.0.1');

if (process.env.NODE_ENV !== 'test') {
  logger.info(`Start Open Terms Archive API on http://localhost:${port}${BASE_PATH}`);
}

export default app;
