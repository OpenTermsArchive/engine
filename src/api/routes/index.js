import express from 'express';

import servicesRouter from './services.js';
import specsRouter from './specs.js';

const apiRouter = express.Router();

apiRouter.use('/specs', specsRouter);
apiRouter.use('/services', servicesRouter);

export default apiRouter;
