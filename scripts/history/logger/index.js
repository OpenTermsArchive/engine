import winston from 'winston';

import logger from '../../../src/logger/index.js';

const { combine, timestamp, printf, colorize } = winston.format;

export const format = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ level, message, timestamp, serviceId, type, id, current, total }) => {
    let prefix = ''.padEnd(8);

    if (current && total) {
      prefix = `${Number(((current) / total) * 100).toFixed(2)}%`.padEnd(8);
    }

    if (serviceId) {
      prefix += `${serviceId}`.padEnd(30);
    }

    if (type) {
      if (type.length > 50) {
        type = `${type.substring(0, 48)}…`;
      }

      prefix += `${type}`.padEnd(50);
    }

    if (id) {
      prefix += `${id}`.padEnd(42);
    }

    return `${timestamp} ${level.padEnd(15)} ${prefix}${message}`;
  }),
);

logger.format = format;

export default logger;
