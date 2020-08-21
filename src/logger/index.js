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

export function onStartTrackingChanges() {
  logger.info({ message: 'Start tracking changes…' });
}

export function onEndTrackingChanges() {
  logger.info({ message: 'Tracking changes done.' });
}

export function onStartRefiltering() {
  logger.info({ message: 'Refiltering documents… (it could take a while)' });
}

export function onEndRefiltering() {
  logger.info({ message: 'Refiltering done.' });
}

export function onFirstSnapshotRecorded(serviceId, type, snapshotId) {
  logger.info({ message: `Recorded first snapshot with id ${snapshotId}.`, serviceId, type });
}

export function onSnapshotRecorded(serviceId, type, snapshotId) {
  logger.info({ message: `Recorded snapshot with id ${snapshotId}.`, serviceId, type });
}

export function onNoSnapshotChanges(serviceId, type) {
  logger.info({ message: 'No changes, did not record snapshot.', serviceId, type });
}

export function onFirstVersionRecorded(serviceId, type, versionId) {
  logger.info({ message: `Recorded first version with id ${versionId}.`, serviceId, type });
}

export function onVersionRecorded(serviceId, type, versionId) {
  logger.info({ message: `Recorded version with id ${versionId}.`, serviceId, type });
}

export function onNoVersionChanges(serviceId, type) {
  logger.info({ message: 'No changes after filtering, did not record version.', serviceId, type });
}

export function onChangesPublished() {
  logger.info({ message: 'Changes published' });
}

export function onApplicationError(error) {
  logger.error({ message: `ApplicationError: ${error}` });
}

export function onRecordRefilterError(serviceId, type, error) {
  logger.error({ message: `Could not refilter: ${error}`, serviceId, type });
}

export function onDocumentUpdateError(serviceId, type, error) {
  logger.error({ message: `Could not update document: ${error}`, serviceId, type });
}

export function onDocumentFetchError(serviceId, type, error) {
  logger.error({ message: `Could not fetch document: ${error}`, serviceId, type });
}
