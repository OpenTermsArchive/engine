import express from 'express';
import swaggerUi from 'swagger-ui-express';

import servicesRouter from './services.js';
import specsRouter, { specs } from './specs.js';

const apiRouter = express.Router();

apiRouter.use('/specs', specsRouter);
apiRouter.use('/docs', swaggerUi.serve);
apiRouter.get('/docs', swaggerUi.setup(specs));
apiRouter.use('/services', servicesRouter);

export default apiRouter;
