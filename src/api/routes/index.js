import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import servicesRouter from './services.js';
import specsRouter, { specs } from './specs.js';

const apiRouter = express.Router();

apiRouter.use('/docs', swaggerUi.serve);
apiRouter.get('/docs', swaggerUi.setup(specs));

apiRouter.use(helmet()); // Register `helmet` after swaggerUi routes to ensure insecure requests won't be upgraded to secure requests for swaggerUI assets; see https://github.com/scottie1984/swagger-ui-express/issues/212#issuecomment-825803088

apiRouter.use('/specs', specsRouter);
apiRouter.use('/services', servicesRouter);

export default apiRouter;
