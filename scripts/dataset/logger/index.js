import winston from 'winston';

import logger from '../../../src/logger/index.js';

const { combine, timestamp, printf, colorize } = winston.format;

logger.format = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ level, message, counter, hash, timestamp }) => {
    const prefix = counter && hash ? `${counter.toString().padEnd(6)} ${hash.padEnd(40)}` : '';

    const timestampPrefix = process.env.NODE_ENV !== 'production' ? `${timestamp} ` : '';

    return `${timestampPrefix}${level.padEnd(15)} ${prefix.padEnd(50)} ${message}`;
  }),
);

export default logger;
