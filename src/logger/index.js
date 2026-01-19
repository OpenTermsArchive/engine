import os from 'os';

import config from 'config';
import winston from 'winston';

import { getCollection } from '../archivist/collection/index.js';

import MailTransportWithRetry from './mail-transport-with-retry.js';
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

const consoleTransport = new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' });

const transports = [consoleTransport];

const logger = winston.createLogger({
  format: alignedWithColorsAndTime,
  transports,
  rejectionHandlers: transports,
  exitOnError: true,
});

logger.on('error', err => {
  if ('smtp' in err) { // Check if err has an `smtp` property, even if it's undefined
    logger.warn({ message: `Uncaught exception from SMTP mailer detected and treated as an operational error; process will continue running:\n${err.stack}` });

    return; // Prevent process exit
  }

  return process.exit(1); // Exit process for other errors
});

if (config.get('@opentermsarchive/engine.logger.sendMailOnError')) {
  if (process.env.OTA_ENGINE_SMTP_PASSWORD === undefined) {
    logger.warn('Environment variable "OTA_ENGINE_SMTP_PASSWORD" was not found; log emails cannot be sent');
  } else {
    const mailerOptions = {
      to: config.get('@opentermsarchive/engine.logger.sendMailOnError.to'),
      from: config.get('@opentermsarchive/engine.logger.sendMailOnError.from'),
      host: config.get('@opentermsarchive/engine.logger.smtp.host'),
      port: config.get('@opentermsarchive/engine.logger.smtp.port'),
      username: config.get('@opentermsarchive/engine.logger.smtp.username'),
      password: process.env.OTA_ENGINE_SMTP_PASSWORD,
      tls: true,
      timeout: 60 * 1000,
      html: false,
      formatter({ message, level }) {
        const isError = level.includes('error');
        const titleColor = isError ? '#dc3545' : '#ffc107';
        const titleText = isError ? 'Error details' : 'Warning details';

        return `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
              <title>OTA Error Report</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 800px; margin: 0 auto; padding: 0px 20px 20px 20px;">
              <h1 style="color: #212529; font-size: 24px; margin: 10px 0; text-align: center; padding-bottom: 10px;">Open Terms Archive engine error report — ${collection.name} Collection</h1>
              
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 0;">
                <h2 style="color: ${titleColor}; margin: 0 0 0 0; font-size: 20px; border-bottom: 2px solid ${titleColor}; padding-bottom: 8px;">${titleText}</h2>
                <div style="background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 4px; padding: 12px; margin: 8px 0;">
                  <code style="maring: 0; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 14px; color: #212529; white-space: pre-wrap; display: block;">${message}</code>
                </div>
              </div>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 0;">
                <h2 style="color: #212529; margin: 0 0 0 0; font-size: 20px; border-bottom: 2px solid #212529; padding-bottom: 8px;">System information</h2>
                <div style="color: #6c757d; font-size: 14px; margin: 0;">
                  Hostname: ${os.hostname()}<br>
                  Platform: ${os.platform()} ${os.release()}<br>
                  Architecture: ${os.arch()}<br>
                  CPU Cores: ${os.cpus().length}<br>
                  CPU Load (1/5/15 min): ${os.loadavg().map(load =>
    `${Math.min(100, (load / os.cpus().length) * 100).toFixed(1)}%`).join(' / ')}<br>
                  Total Memory: ${(os.totalmem() / (1024 * 1024 * 1024)).toFixed(2)} GB<br>
                  Free Memory: ${(os.freemem() / (1024 * 1024 * 1024)).toFixed(2)} GB${collection.host ? `<br>
                  Server IP: ${collection.host}` : ''}
                </div>
              </div>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 0;">
                <h2 style="color: #198754; margin: 0 0 0 0; font-size: 20px; border-bottom: 2px solid #198754; padding-bottom: 8px;">Helpful commands</h2>
                <ul style="list-style-type: none; padding-left: 0; margin: 0;">
                  ${collection.host && collection.hostConfig?.ansible_user ? `
                  <li style="margin: 0; padding: 0">
                    <strong style="display: block; margin-bottom: 0;">Connect to the server:</strong>
                    <code style="maring: 0; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 4px; padding: 6px 10px; display: inline-block; color: #212529; cursor: text; user-select: all; -webkit-user-select: all; -moz-user-select: all; -ms-user-select: all;">ssh ${collection.hostConfig.ansible_user}@${collection.host}</code>
                  </li>` : ''}

                  <li style="margin: 0; padding: 0">
                    <strong style="display: block; margin-bottom: 0;">List processes on the server:</strong>
                    <code style="maring: 0; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 4px; padding: 6px 10px; display: inline-block; color: #212529; cursor: text; user-select: all; -webkit-user-select: all; -moz-user-select: all; -ms-user-select: all;">pm2 list</code>
                  </li>

                  <li style="margin: 0; padding: 0">
                    <strong style="display: block; margin-bottom: 0;">View the logs on the server:</strong>
                    <code style="maring: 0; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 4px; padding: 6px 10px; display: inline-block; color: #212529; cursor: text; user-select: all; -webkit-user-select: all; -moz-user-select: all; -ms-user-select: all;">pm2 logs &lt;process-name&gt;</code>
                  </li>

                  <li style="margin: 0; padding: 0">
                    <strong style="display: block; margin-bottom: 0;">View additional logging options:</strong>
                    <code style="maring: 0; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 4px; padding: 6px 10px; display: inline-block; color: #212529; cursor: text; user-select: all; -webkit-user-select: all; -moz-user-select: all; -ms-user-select: all;">pm2 logs &lt;process-name&gt; --help</code>
                  </li>

                  <li style="margin: 0; padding: 0">
                    <strong style="display: block; margin-bottom: 0;">View deployment documentation to see how to start, stop, and restart the server:</strong>
                    <a href="https://github.com/OpenTermsArchive/deployment" style="color: #198754; text-decoration: none; border-bottom: 1px solid #198754;">github.com/OpenTermsArchive/deployment</a>
                  </li>
                </ul>
              </div>

              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; text-align: center;">
                This is an automated message from the Open Terms Archive engine. Please do not reply to this email.
              </div>
            </body>
          </html>
        `;
      },
    };

    transports.push(new MailTransportWithRetry({
      ...mailerOptions,
      level: 'error',
      subject: `Server error on ${collection.id} collection`,
    }));

    if (config.get('@opentermsarchive/engine.logger.sendMailOnError.sendWarnings')) {
      transports.push(new MailTransportWithRetry({
        ...mailerOptions,
        level: 'warn',
        subject: `Inaccessible content on ${collection.id} collection`,
      }));
    }
  }
}

logger.configure({
  transports,
  rejectionHandlers: transports,
  exitOnError: true,
});

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
