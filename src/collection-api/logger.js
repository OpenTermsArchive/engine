import config from 'config';
import dotenv from 'dotenv';
import winston from 'winston';

import { addErrorMail } from '../logger/error-mail.js';

dotenv.config({ quiet: true });

const { combine, timestamp, printf, colorize } = winston.format;

const logger = winston.createLogger({
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ssZ' }),
    printf(({ level, message, timestamp }) => {
      const timestampPrefix = config.get('@opentermsarchive/engine.logger.timestampPrefix') ? `${timestamp} ` : '';

      return `${timestampPrefix}${level.padEnd(15)} ${message}`;
    }),
  ),
  transports: [new winston.transports.Console({ handleRejections: true })],
  exitOnError: false,
});

await addErrorMail(logger, { component: 'Collection API', subject: 'API error' });

export default logger;
