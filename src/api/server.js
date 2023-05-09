import config from 'config';
import express from 'express';
import helmet from 'helmet';

import Archivist from '../archivist/index.js';

import logger from './logger.js';
import servicesRouter from './routes/services.js';
import specsRouter from './routes/specs.js';

const archivist = await new Archivist({ recorderConfig: config.get('recorder') }).initialize();

const apiRouter = express.Router();

apiRouter.get('/specs', specsRouter);
apiRouter.use('/services', servicesRouter(archivist.services));

const app = express();

app.use(helmet());
app.use(`${config.get('api.basePath')}/v1`, apiRouter);

app.listen(config.get('api.port'));

logger.info('Start Open Terms Archive collection metadata API\n');

export default app;
