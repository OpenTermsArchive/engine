import config from 'config';
import winston from 'winston';

import { getCollection } from '../archivist/collection/index.js';

import { createErrorMailTransports, exitOnUnhandledRejection } from './error-mail.js';
import { formatDuration } from './utils.js';

const { combine, timestamp, printf, colorize } = winston.format;

const collection = await getCollection();

const alignedWithColorsAndTime = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DDTHH:mm:ssZ' }),
  printf(({ level, message, timestamp, serviceId, termsType, documentId }) => {
    const servicePrefix = serviceId && termsType
      ? `${serviceId} — ${termsType}${documentId ? `:${documentId}` : ''}`
      : '';

    const truncatedPrefix = servicePrefix.length > 75 ? `${servicePrefix.slice(0, 74)}…` : servicePrefix;

    const timestampPrefix = config.get('@opentermsarchive/engine.logger.timestampPrefix') ? `${timestamp} ` : '';

    return `${timestampPrefix}${level.padEnd(15)} ${truncatedPrefix.padEnd(75)} ${message}`;
  }),
);

const consoleTransport = new winston.transports.Console({ silent: process.env.NODE_ENV === 'test', handleRejections: true });

const transports = [
  consoleTransport,
  ...createErrorMailTransports({
    collection,
    component: 'engine',
    subject: `Server error on ${collection.id} collection`,
    warningSubject: `Inaccessible content on ${collection.id} collection`,
  }),
];

const logger = winston.createLogger({
  format: alignedWithColorsAndTime,
  transports,
  exitOnError: false,
});

exitOnUnhandledRejection(transports);

let recordedSnapshotsCount;
let recordedVersionsCount;
let trackingStartTime;

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

logger.onTrackingStarted = (numberOfServices, numberOfTerms, technicalUpgradeOnly) => {
  if (technicalUpgradeOnly) {
    logger.info(`Applying technical upgrades to ${numberOfTerms} terms from ${numberOfServices} services…`);
  } else {
    logger.info(`Tracking changes of ${numberOfTerms} terms from ${numberOfServices} services…`);
  }
  recordedSnapshotsCount = 0;
  recordedVersionsCount = 0;
  trackingStartTime = Date.now();
};

logger.onTrackingCompleted = (numberOfServices, numberOfTerms, technicalUpgradeOnly) => {
  const duration = formatDuration(Date.now() - trackingStartTime);

  if (technicalUpgradeOnly) {
    logger.info(`Applied technical upgrades to ${numberOfTerms} terms from ${numberOfServices} services in ${duration}`);
    logger.info(`Recorded ${recordedVersionsCount} new versions\n`);
  } else {
    logger.info(`Tracked changes of ${numberOfTerms} terms from ${numberOfServices} services in ${duration}`);
    logger.info(`Recorded ${recordedSnapshotsCount} new snapshots and ${recordedVersionsCount} new versions\n`);
  }
};

logger.onInaccessibleContent = ({ message }, terms) => {
  logger.warn({ message, serviceId: terms.service.id, termsType: terms.type });
};

const createLogHandler = level => params => {
  if (typeof params === 'string') {
    logger[level]({ message: params });
  } else {
    const { serviceId, termsType, documentId, id, message } = params;

    logger[level]({ message, serviceId, termsType, documentId, id });
  }
};

logger.onError = createLogHandler('error');
logger.onInfo = createLogHandler('info');
logger.onWarn = createLogHandler('warn');

logger.onPluginError = (error, pluginName) => {
  logger.error({ message: `Error in "${pluginName}" plugin: ${error.stack}` });
};

export default logger;
