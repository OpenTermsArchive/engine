import config from 'config';
import express from 'express';

import Archivist from '../../archivist/index.js';

import servicesRouter from './services.js';
import specsRouter from './specs.js';

const apiRouter = express.Router();
const archivist = await new Archivist({ recorderConfig: config.get('recorder') }).initialize();

apiRouter.use('/specs', specsRouter);
apiRouter.use('/services', servicesRouter(archivist.services));

export default apiRouter;
