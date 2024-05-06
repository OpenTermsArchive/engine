import os from 'os';

import config from 'config';
import winston from 'winston';
import 'winston-mail';

const { combine, timestamp, printf, colorize } = winston.format;

const alignedWithColorsAndTime = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ level, message, timestamp, serviceId, termsType, documentId }) => {
    let prefix = '';

    if (serviceId && termsType) {
      prefix = `${serviceId} — ${termsType}`;
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

const consoleTransport = new winston.transports.Console(({ silent: process.env.NODE_ENV === 'test' }));

const transports = [consoleTransport];

const logger = winston.createLogger({
  format: alignedWithColorsAndTime,
  transports,
  rejectionHandlers: transports,
});

if (config.get('logger.sendMailOnError')) {
  if (process.env.SMTP_PASSWORD === undefined) {
    logger.warn('Environment variable "SMTP_PASSWORD" was not found; log emails cannot be sent');
  } else {
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

    logger.configure({
      transports,
      rejectionHandlers: transports,
    });
  }
}

let recordedSnapshotsCount;
let recordedVersionsCount;

logger.onFirstSnapshotRecorded = ({ serviceId, termsType, documentId, id }) => {
  logger.info({ message: `Recorded first snapshot with id ${id}`, serviceId, termsType, documentId });
  recordedSnapshotsCount++;
};

logger.onSnapshotRecorded = ({ serviceId, termsType, documentId, id }) => {
  logger.info({ message: `Recorded snapshot with id ${id}`, serviceId, termsType, documentId });
  recordedSnapshotsCount++;
};

logger.onSnapshotNotChanged = ({ serviceId, termsType, documentId }) => {
  logger.info({ message: 'No changes, did not record snapshot', serviceId, termsType, documentId });
};

logger.onFirstVersionRecorded = ({ serviceId, termsType, id }) => {
  logger.info({ message: `Recorded first version with id ${id}`, serviceId, termsType });
  recordedVersionsCount++;
};

logger.onVersionRecorded = ({ serviceId, termsType, id }) => {
  logger.info({ message: `Recorded version with id ${id}`, serviceId, termsType });
  recordedVersionsCount++;
};

logger.onVersionNotChanged = ({ serviceId, termsType }) => {
  logger.info({ message: 'No changes after filtering, did not record version', serviceId, termsType });
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

logger.onInaccessibleContent = ({ message }, terms) => {
  logger.warn({ message, serviceId: terms.service.id, termsType: terms.type });
};

logger.onError = (error, terms) => {
  logger.error({ message: error.stack, serviceId: terms.service.id, termsType: terms.type });
};

logger.onPluginError = (error, pluginName) => {
  logger.error({ message: `Error in "${pluginName}" plugin: ${error.stack}` });
};

export default logger;
