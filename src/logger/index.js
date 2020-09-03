import winston from 'winston';

const { combine, timestamp, align, printf, colorize } = winston.format;

const alignedWithColorsAndTime = combine(colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  align(),
  printf(({ level, message, timestamp, serviceId, type }) => {
    let prefix = '';
    if (serviceId && type) {
      prefix = `${serviceId} — ${type}`;
    }
    return `${timestamp} ${level.padEnd(15)} ${prefix.padEnd(55)} ${message}`;
  }));

const logger = winston.createLogger({
  format: alignedWithColorsAndTime,
  transports: [
    new winston.transports.Console({
      handleExceptions: true
    }),
  ],
  exitOnError: false
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

export function onRefilteringError(serviceId, type, error) {
  logger.error({ message: `Could not refilter document: ${error.stack}`, serviceId, type });
}

export function onDocumentTrackingError(serviceId, type, error) {
  logger.error({ message: `Could not track document: ${error.stack}`, serviceId, type });
}
