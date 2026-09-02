import config from 'config';
import dotenv from 'dotenv';
import winston from 'winston';

import { getCollection } from '../archivist/collection/index.js';
import MailTransportWithRetry from '../logger/mail-transport-with-retry.js';

dotenv.config({ quiet: true });

const { combine, timestamp, printf, colorize } = winston.format;

const collection = await getCollection();

const transports = [new winston.transports.Console()];

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

logger.on('error', err => {
  if ('smtp' in err) { // Check if err has an `smtp` property, even if it's undefined
    logger.warn(`Uncaught exception from SMTP mailer detected and treated as an operational error; process will continue running:\n${err.stack}`);

    return; // Prevent process exit
  }

  return process.exit(1); // Exit process for other errors
});

if (config.get('@opentermsarchive/engine.logger.sendMailOnError')) {
  if (process.env.OTA_ENGINE_SMTP_PASSWORD === undefined) {
    logger.warn('Environment variable "OTA_ENGINE_SMTP_PASSWORD" was not found; log emails cannot be sent');
  } else {
    transports.push(new MailTransportWithRetry({
      to: config.get('@opentermsarchive/engine.logger.sendMailOnError.to'),
      from: config.get('@opentermsarchive/engine.logger.sendMailOnError.from'),
      host: config.get('@opentermsarchive/engine.logger.smtp.host'),
      port: config.get('@opentermsarchive/engine.logger.smtp.port'),
      username: config.get('@opentermsarchive/engine.logger.smtp.username'),
      password: process.env.OTA_ENGINE_SMTP_PASSWORD,
      tls: true,
      timeout: 60 * 1000,
      formatter: args => args[Object.getOwnPropertySymbols(args)[1]], // Returns the full error message, the same visible in the console. It is referenced in the argument object with a Symbol of which we do not have the reference but we know it is the second one.
      level: 'error',
      subject: `API error on ${collection.id} collection`,
    }));
  }
}

logger.configure({
  transports,
  rejectionHandlers: transports,
});

export default logger;
