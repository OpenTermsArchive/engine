import os from 'os';

import config from 'config';
import dotenv from 'dotenv';
import winston from 'winston';
import 'winston-mail';

dotenv.config();

const { combine, timestamp, printf, colorize } = winston.format;

const transports = [new winston.transports.Console()];

if (config.get('@opentermsarchive/engine.logger.sendMailOnError')) {
  transports.push(new winston.transports.Mail({
    to: config.get('@opentermsarchive/engine.logger.sendMailOnError.to'),
    from: config.get('@opentermsarchive/engine.logger.sendMailOnError.from'),
    host: config.get('@opentermsarchive/engine.logger.smtp.host'),
    username: config.get('@opentermsarchive/engine.logger.smtp.username'),
    password: process.env.SMTP_PASSWORD,
    ssl: true,
    timeout: 30 * 1000,
    formatter: args => args[Object.getOwnPropertySymbols(args)[1]], // Returns the full error message, the same visible in the console. It is referenced in the argument object with a Symbol of which we do not have the reference but we know it is the second one.
    exitOnError: true,
    level: 'error',
    subject: `[OTA API] Error Report — ${os.hostname()}`,
  }));
}

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

export default logger;
