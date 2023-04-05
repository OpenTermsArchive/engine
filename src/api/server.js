import config from 'config';
import express from 'express';
import helmet from 'helmet';

const app = express();

app.use(helmet());
app.listen(config.get('api.port'));

console.debug(`Server listening on port ${config.get('api.port')}`);
