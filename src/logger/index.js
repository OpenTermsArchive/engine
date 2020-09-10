import winston from 'winston';
import 'winston-mail';

import config from 'config';
import dotenv from 'dotenv';

dotenv.config();
const { combine, timestamp, printf, colorize } = winston.format;

const alignedWithColorsAndTime = combine(colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ level, message, timestamp, serviceId, type }) => {
    let prefix = '';
    if (serviceId && type) {
      prefix = `${serviceId} — ${type}`;
    }
    return `${timestamp} ${level.padEnd(15)} ${prefix.padEnd(55)} ${message}`;
  }));

const consoleTransport = new winston.transports.Console();

const transports = [ consoleTransport ];

if (config.get('logger.sendMailOnError')) {
  const mailErrorTransport = new winston.transports.Mail({
    level: 'error',
    to: config.get('logger.sendMailOnError.to'),
    from: config.get('logger.sendMailOnError.from'),
    subject: '[CGUs] Error Report',
    host: process.env.SMTP_HOST,
    username: process.env.SMTP_USERNAME,
    password: process.env.SMTP_PASSWORD,
    ssl: true,
    formatter: args => args[Object.getOwnPropertySymbols(args)[1]] // Returns the full error message, the same visible in the console. It is referenced in the argument object with a Symbol of which we do not have the reference but we know it is the second one.
  });

  transports.push(mailErrorTransport);
}

const logger = winston.createLogger({
  format: alignedWithColorsAndTime,
  transports,
  rejectionHandlers: transports,
});

export function onFirstSnapshotRecorded(serviceId, type, snapshotId) {
  logger.info({ message: `Recorded first snapshot with id ${snapshotId}.`, serviceId, type });
}

export function onSnapshotRecorded(serviceId, type, snapshotId) {
  logger.info({ message: `Recorded snapshot with id ${snapshotId}.`, serviceId, type });
}

export function onSnapshotNotChanged(serviceId, type) {
  logger.info({ message: 'No changes, did not record snapshot.', serviceId, type });
}

export function onFirstVersionRecorded(serviceId, type, versionId) {
  logger.info({ message: `Recorded first version with id ${versionId}.`, serviceId, type });
}

export function onVersionRecorded(serviceId, type, versionId) {
  logger.info({ message: `Recorded version with id ${versionId}.`, serviceId, type });
}

export function onVersionNotChanged(serviceId, type) {
  logger.info({ message: 'No changes after filtering, did not record version.', serviceId, type });
}

export function onRecordsPublished() {
  logger.info({ message: 'Records published.' });
}

export function onInaccessibleContent(serviceId, type, error) {
  logger.warn({ message: `Content inacessible: ${error.message}`, serviceId, type });
}

export function info(options) {
  logger.info(options);
}

export function error(options) {
  logger.error(options);
}

export function warn(options) {
  logger.warn(options);
}
