import morgan from 'morgan';

import logger from '../logger.js';

const middleware = morgan('tiny', { stream: { write: message => logger.info(message.trim()) } });

export default middleware;
