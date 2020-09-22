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
  const mailerOptions = {
    to: config.get('logger.sendMailOnError.to'),
    from: config.get('logger.sendMailOnError.from'),
    host: process.env.SMTP_HOST,
    username: process.env.SMTP_USERNAME,
    password: process.env.SMTP_PASSWORD,
    ssl: true,
    formatter: args => args[Object.getOwnPropertySymbols(args)[1]] // Returns the full error message, the same visible in the console. It is referenced in the argument object with a Symbol of which we do not have the reference but we know it is the second one.
  };

  transports.push(new winston.transports.Mail({
    ...mailerOptions,
    level: 'error',
    subject: '[CGUs] Error Report',
  }));

  transports.push(new winston.transports.Mail({
    ...mailerOptions,
    level: 'warn',
    subject: '[CGUs] Inaccessible content',
  }));
}

const logger = winston.createLogger({
  format: alignedWithColorsAndTime,
  transports,
  rejectionHandlers: transports,
});

logger.onFirstSnapshotRecorded = (serviceId, type, snapshotId) => {
  logger.info({ message: `Recorded first snapshot with id ${snapshotId}.`, serviceId, type });
};

logger.onSnapshotRecorded = (serviceId, type, snapshotId) => {
  logger.info({ message: `Recorded snapshot with id ${snapshotId}.`, serviceId, type });
};

logger.onSnapshotNotChanged = (serviceId, type) => {
  logger.info({ message: 'No changes, did not record snapshot.', serviceId, type });
};

logger.onFirstVersionRecorded = (serviceId, type, versionId) => {
  logger.info({ message: `Recorded first version with id ${versionId}.`, serviceId, type });
};

logger.onVersionRecorded = (serviceId, type, versionId) => {
  logger.info({ message: `Recorded version with id ${versionId}.`, serviceId, type });
};

logger.onVersionNotChanged = (serviceId, type) => {
  logger.info({ message: 'No changes after filtering, did not record version.', serviceId, type });
};

logger.onRecordsPublished = () => {
  logger.info({ message: 'Records published.' });
};

logger.onInaccessibleContent = (serviceId, type, error) => {
  logger.warn({ message: `Content inacessible: ${error.message}`, serviceId, type });
};

export default logger;
