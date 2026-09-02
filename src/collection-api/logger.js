import config from 'config';
import dotenv from 'dotenv';
import winston from 'winston';

import { getCollection } from '../archivist/collection/index.js';
import { createErrorMailTransports, handleTransportErrors } from '../logger/error-mail.js';

dotenv.config({ quiet: true });

const { combine, timestamp, printf, colorize } = winston.format;

const collection = await getCollection();

const transports = [
  new winston.transports.Console(),
  ...createErrorMailTransports({
    formatter: args => args[Object.getOwnPropertySymbols(args)[1]], // Returns the full error message, the same visible in the console. It is referenced in the argument object with a Symbol of which we do not have the reference but we know it is the second one.
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
  rejectionHandlers: transports,
});

handleTransportErrors(logger);

export default logger;
