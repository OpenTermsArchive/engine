import os from 'os';

import config from 'config';
import dotenv from 'dotenv';
import winston from 'winston';
import 'winston-mail';

dotenv.config();
const { combine, timestamp, printf, colorize } = winston.format;

const alignedWithColorsAndTime = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ level, message, timestamp, serviceId, type, documentId }) => {
    let prefix = '';

    if (serviceId && type) {
      prefix = `${serviceId} — ${type}`;
    }

    if (documentId) {
      prefix = `${prefix}:${documentId}`;
    }

    if (prefix.length > 75) {
      prefix = `${prefix.substring(0, 74)}…`;
    }

    return `${timestamp} ${level.padEnd(15)} ${prefix.padEnd(75)} ${message}`;
  }),
);

const consoleTransport = new winston.transports.Console();

const transports = [consoleTransport];

if (config.get('logger.sendMailOnError')) {
  const mailerOptions = {
    to: config.get('logger.sendMailOnError.to'),
    from: config.get('logger.sendMailOnError.from'),
    host: config.get('logger.smtp.host'),
    username: config.get('logger.smtp.username'),
    password: process.env.SMTP_PASSWORD,
    ssl: true,
    timeout: 30 * 1000,
    formatter: args => args[Object.getOwnPropertySymbols(args)[1]], // Returns the full error message, the same visible in the console. It is referenced in the argument object with a Symbol of which we do not have the reference but we know it is the second one.
    exitOnError: true,
  };

  transports.push(new winston.transports.Mail({
    ...mailerOptions,
    level: 'error',
    subject: `[OTA] Error Report — ${os.hostname()}`,
  }));

  if (config.get('logger.sendMailOnError.sendWarnings')) {
    transports.push(new winston.transports.Mail({
      ...mailerOptions,
      level: 'warn',
      subject: `[OTA] Inaccessible content — ${os.hostname()}`,
    }));
  }
}

let recordedSnapshotsCount;
let recordedVersionsCount;

const logger = winston.createLogger({
  format: alignedWithColorsAndTime,
  transports,
  rejectionHandlers: transports,
});

logger.onFirstSnapshotRecorded = (serviceId, type, documentId, snapshotId) => {
  logger.info({ message: `Recorded first snapshot with id ${snapshotId}`, serviceId, type, documentId });
  recordedSnapshotsCount++;
};

logger.onSnapshotRecorded = (serviceId, type, documentId, snapshotId) => {
  logger.info({ message: `Recorded snapshot with id ${snapshotId}`, serviceId, type, documentId });
  recordedSnapshotsCount++;
};

logger.onSnapshotNotChanged = (serviceId, type, documentId) => {
  logger.info({ message: 'No changes, did not record snapshot', serviceId, type, documentId });
};

logger.onFirstVersionRecorded = (serviceId, type, versionId) => {
  logger.info({ message: `Recorded first version with id ${versionId}`, serviceId, type });
  recordedVersionsCount++;
};

logger.onVersionRecorded = (serviceId, type, versionId) => {
  logger.info({ message: `Recorded version with id ${versionId}`, serviceId, type });
  recordedVersionsCount++;
};

logger.onVersionNotChanged = (serviceId, type) => {
  logger.info({ message: 'No changes after filtering, did not record version', serviceId, type });
};

logger.onTrackingStarted = (numberOfServices, numberOfTerms, extractOnly) => {
  if (extractOnly) {
    logger.info(`Examining ${numberOfTerms} terms from ${numberOfServices} services for extraction…`);
  } else {
    logger.info(`Tracking changes of ${numberOfTerms} terms from ${numberOfServices} services…`);
  }
  recordedSnapshotsCount = 0;
  recordedVersionsCount = 0;
};

logger.onTrackingCompleted = (numberOfServices, numberOfTerms, extractOnly) => {
  if (extractOnly) {
    logger.info(`Examined ${numberOfTerms} terms from ${numberOfServices} services for extraction`);
    logger.info(`Recorded ${recordedVersionsCount} new versions\n`);
  } else {
    logger.info(`Tracked changes of ${numberOfTerms} terms from ${numberOfServices} services`);
    logger.info(`Recorded ${recordedSnapshotsCount} new snapshots and ${recordedVersionsCount} new versions\n`);
  }
};

logger.onInaccessibleContent = ({ message }, serviceId, type) => {
  logger.warn({ message, serviceId, type });
};

logger.onError = (error, serviceId, type, documentId) => {
  logger.error({ message: error.stack, serviceId, type, documentId });
};

export default logger;
