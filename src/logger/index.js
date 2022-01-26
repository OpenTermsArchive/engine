import 'winston-mail';

import config from 'config';
import dotenv from 'dotenv';
import winston from 'winston';

dotenv.config();
const { combine, timestamp, printf, colorize } = winston.format;

const alignedWithColorsAndTime = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ level, message, timestamp, serviceId, type }) => {
    let prefix = '';

    if (serviceId && type) {
      prefix = `${serviceId} — ${type}`;
    }

    return `${timestamp} ${level.padEnd(15)} ${prefix.padEnd(55)} ${message}`;
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
    subject: '[OTA] Error Report',
  }));

  if (config.get('logger.sendMailOnError.sendWarnings')) {
    transports.push(new winston.transports.Mail({
      ...mailerOptions,
      level: 'warn',
      subject: '[OTA] Inaccessible content',
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

logger.onFirstSnapshotRecorded = (serviceId, type, snapshotId) => {
  logger.info({ message: `Recorded first snapshot with id ${snapshotId}`, serviceId, type });
  recordedSnapshotsCount++;
};

logger.onSnapshotRecorded = (serviceId, type, snapshotId) => {
  logger.info({ message: `Recorded snapshot with id ${snapshotId}`, serviceId, type });
  recordedSnapshotsCount++;
};

logger.onSnapshotNotChanged = (serviceId, type) => {
  logger.info({ message: 'No changes, did not record snapshot', serviceId, type });
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

logger.onRefilteringStarted = (numberOfServices, numberOfDocuments) => {
  logger.info(`Examining ${numberOfDocuments} documents from ${numberOfServices} services for refiltering…`);
  recordedVersionsCount = 0;
};

logger.onRefilteringCompleted = (numberOfServices, numberOfDocuments) => {
  logger.info(`Examined ${numberOfDocuments} documents from ${numberOfServices} services for refiltering.`);
  logger.info(`Recorded ${recordedVersionsCount} new versions.\n`);
};

logger.onTrackingStarted = (numberOfServices, numberOfDocuments) => {
  logger.info(`Tracking changes of ${numberOfDocuments} documents from ${numberOfServices} services…`);
  recordedSnapshotsCount = 0;
  recordedVersionsCount = 0;
};

logger.onTrackingCompleted = (numberOfServices, numberOfDocuments) => {
  logger.info(`Tracked changes of ${numberOfDocuments} documents from ${numberOfServices} services.`);
  logger.info(`Recorded ${recordedSnapshotsCount} new snapshots and ${recordedVersionsCount} new versions.\n`);
};

logger.onInaccessibleContent = ({ message }, serviceId, type) => {
  logger.warn({ message, serviceId, type });
};

logger.onError = (error, serviceId, type) => {
  logger.error({ message: error.stack, serviceId, type });
};

export default logger;
