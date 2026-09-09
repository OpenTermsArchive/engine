import config from 'config';
import dotenv from 'dotenv';
import winston from 'winston';

import { getCollection } from '../archivist/collection/index.js';
import { createErrorMailTransports } from '../logger/error-mail.js';

dotenv.config({ quiet: true });

const { combine, timestamp, printf, colorize } = winston.format;

const collection = await getCollection();

const transports = [
  new winston.transports.Console({ handleRejections: true }),
  ...createErrorMailTransports({
    collection,
    component: 'Collection API',
    subject: `API error on ${collection.id} collection`,
  }),
];

const logger = winston.createLogger({
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ssZ' }),
    printf(({ level, message, timestamp }) => {
      const timestampPrefix = config.get('@opentermsarchive/engine.logger.timestampPrefix') ? `${timestamp} ` : '';

      return `${timestampPrefix}${level.padEnd(15)} ${message}`;
    }),
  ),
  transports,
});

export default logger;
