import config from 'config';
import express from 'express';
import helmet from 'helmet';

import logger from './logger.js';

const app = express();

app.use(helmet());
app.listen(config.get('api.port'));

logger.info('Start Open Terms Archive Collection metadata API\n');
