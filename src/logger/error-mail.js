import os from 'os';

import config from 'config';
import winston from 'winston';

import MailTransportWithRetry from './mail-transport-with-retry.js';
import { escapeHtml } from './utils.js';

const SMTP_TIMEOUT = 60 * 1000;

const CODE_STYLE = "font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 4px; padding: 6px 10px; display: inline-block; color: #212529; cursor: text; user-select: all; -webkit-user-select: all; -moz-user-select: all; -ms-user-select: all;";

const section = (title, color, content) => `
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 0;">
                <h2 style="color: ${color}; margin: 0 0 0 0; font-size: 20px; border-bottom: 2px solid ${color}; padding-bottom: 8px;">${title}</h2>${content}
              </div>`;

const command = (label, code) => `
                  <li style="margin: 0; padding: 0">
                    <strong style="display: block; margin-bottom: 0;">${label}</strong>
                    <code style="${CODE_STYLE}">${escapeHtml(code)}</code>
                  </li>`;

function formatBody({ collection, component, environmentPrefix }, { message, level }) {
  const isError = level.includes('error');
  const titleColor = isError ? '#dc3545' : '#ffc107';
  const titleText = isError ? 'Error details' : 'Warning details';
  const cpuCount = os.cpus().length;

  const commands = [
    ...(collection.host && collection.hostConfig?.ansible_user ? [[ 'Connect to the server:', `ssh ${collection.hostConfig.ansible_user}@${collection.host}` ]] : []),
    [ 'List processes on the server:', 'pm2 list' ],
    [ 'View the logs on the server:', 'pm2 logs <process-name>' ],
    [ 'View additional logging options:', 'pm2 logs <process-name> --help' ],
  ];

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
              <h1 style="color: #212529; font-size: 24px; margin: 10px 0; text-align: center; padding-bottom: 10px;">${escapeHtml(`${environmentPrefix}Open Terms Archive ${component} error report — ${collection.name} Collection`)}</h1>
              ${section(titleText, titleColor, `
                <div style="background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 4px; padding: 12px; margin: 8px 0;">
                  <code style="margin: 0; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 14px; color: #212529; white-space: pre-wrap; display: block;">${escapeHtml(message)}</code>
                </div>`)}
              ${section('System information', '#212529', `
                <div style="color: #6c757d; font-size: 14px; margin: 0;">
                  Hostname: ${escapeHtml(os.hostname())}<br>
                  Platform: ${escapeHtml(`${os.platform()} ${os.release()}`)}<br>
                  Architecture: ${os.arch()}<br>
                  CPU Cores: ${cpuCount}<br>
                  CPU Load (1/5/15 min): ${os.loadavg().map(load => `${Math.min(100, (load / cpuCount) * 100).toFixed(1)}%`).join(' / ')}<br>
                  Total Memory: ${(os.totalmem() / (1024 * 1024 * 1024)).toFixed(2)} GB<br>
                  Free Memory: ${(os.freemem() / (1024 * 1024 * 1024)).toFixed(2)} GB${collection.host ? `<br>
                  Server IP: ${escapeHtml(collection.host)}` : ''}
                </div>`)}
              ${section('Helpful commands', '#198754', `
                <ul style="list-style-type: none; padding-left: 0; margin: 0;">${commands.map(([ label, code ]) => command(label, code)).join('')}
                  <li style="margin: 0; padding: 0">
                    <strong style="display: block; margin-bottom: 0;">View deployment documentation to see how to start, stop, and restart the server:</strong>
                    <a href="https://github.com/OpenTermsArchive/deployment" style="color: #198754; text-decoration: none; border-bottom: 1px solid #198754;">github.com/OpenTermsArchive/deployment</a>
                  </li>
                </ul>`)}
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; text-align: center;">
                This is an automated message from the Open Terms Archive engine. Please do not reply to this email.
              </div>
            </body>
          </html>
        `;
}

export function createErrorMailTransports({ collection, component, subject, warningSubject }) {
  if (!config.get('@opentermsarchive/engine.logger.sendMailOnError')) {
    return [];
  }

  if (process.env.OTA_ENGINE_SMTP_PASSWORD === undefined) {
    console.warn('Environment variable "OTA_ENGINE_SMTP_PASSWORD" was not found; log emails cannot be sent');

    return [];
  }

  const environment = config.util.getEnv('NODE_CONFIG_ENV');
  const environmentPrefix = environment === 'production' ? '' : `[${environment}] `; // Make emails sent from a developer machine recognisable at a glance

  const mailerOptions = {
    to: config.get('@opentermsarchive/engine.logger.sendMailOnError.to'),
    from: config.get('@opentermsarchive/engine.logger.sendMailOnError.from'),
    host: config.get('@opentermsarchive/engine.logger.smtp.host'),
    port: config.get('@opentermsarchive/engine.logger.smtp.port'),
    username: config.get('@opentermsarchive/engine.logger.smtp.username'),
    password: process.env.OTA_ENGINE_SMTP_PASSWORD,
    tls: true,
    timeout: SMTP_TIMEOUT,
    html: true,
    formatter: info => formatBody({ collection, component, environmentPrefix }, info),
    handleRejections: true,
  };

  const transports = [new MailTransportWithRetry({ ...mailerOptions, level: 'error', subject: `${environmentPrefix}${subject}` })];

  if (warningSubject && config.get('@opentermsarchive/engine.logger.sendMailOnError.sendWarnings')) { // Only callers providing a subject for warnings can send them
    transports.push(new MailTransportWithRetry({
      ...mailerOptions,
      level: 'warn',
      subject: `${environmentPrefix}${warningSubject}`,
      format: winston.format(info => (info[Symbol.for('level')] === 'warn' ? info : false))(), // Winston transports receive every level at or above theirs, so errors would otherwise be emailed a second time as warnings
    }));
  }

  return transports;
}

export function handleTransportErrors(logger) {
  logger.on('error', (err, transport) => {
    if (transport instanceof MailTransportWithRetry) {
      console.warn(`Uncaught exception from SMTP mailer detected and treated as an operational error; process will continue running:\n${err.stack}`); // Reported on the console rather than through the logger, which would send this warning back to the failing mailer

      return; // Prevent process exit
    }

    console.error(err); // Registering a listener stops Node from printing the error itself; print it before exiting so the cause stays in the logs

    return process.exit(1); // Exit process for other errors
  });
}
