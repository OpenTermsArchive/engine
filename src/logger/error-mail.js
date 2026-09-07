import config from 'config';

import MailTransportWithRetry from './mail-transport-with-retry.js';

const SMTP_TIMEOUT = 60 * 1000;

export function createErrorMailTransports({ formatter, subject, warningSubject }) {
  if (!config.get('@opentermsarchive/engine.logger.sendMailOnError')) {
    return [];
  }

  if (process.env.OTA_ENGINE_SMTP_PASSWORD === undefined) {
    console.warn('Environment variable "OTA_ENGINE_SMTP_PASSWORD" was not found; log emails cannot be sent');

    return [];
  }

  const mailerOptions = {
    to: config.get('@opentermsarchive/engine.logger.sendMailOnError.to'),
    from: config.get('@opentermsarchive/engine.logger.sendMailOnError.from'),
    host: config.get('@opentermsarchive/engine.logger.smtp.host'),
    port: config.get('@opentermsarchive/engine.logger.smtp.port'),
    username: config.get('@opentermsarchive/engine.logger.smtp.username'),
    password: process.env.OTA_ENGINE_SMTP_PASSWORD,
    tls: true,
    timeout: SMTP_TIMEOUT,
    formatter,
    handleRejections: true,
  };

  const transports = [new MailTransportWithRetry({ ...mailerOptions, level: 'error', subject })];

  if (warningSubject && config.get('@opentermsarchive/engine.logger.sendMailOnError.sendWarnings')) { // Only callers providing a subject for warnings can send them
    transports.push(new MailTransportWithRetry({ ...mailerOptions, level: 'warn', subject: warningSubject }));
  }

  return transports;
}

export function handleTransportErrors(logger) {
  logger.on('error', err => {
    if ('smtp' in err) { // Check if err has an `smtp` property, even if it's undefined
      console.warn(`Uncaught exception from SMTP mailer detected and treated as an operational error; process will continue running:\n${err.stack}`); // Reported on the console rather than through the logger, which would send this warning back to the failing mailer

      return; // Prevent process exit
    }

    console.error(err); // Registering a listener stops Node from printing the error itself; print it before exiting so the cause stays in the logs

    return process.exit(1); // Exit process for other errors
  });
}
