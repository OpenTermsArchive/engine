import config from 'config';
import winston from 'winston';

import logger from '../../../src/logger/index.js';

const { combine, timestamp, printf, colorize } = winston.format;

logger.format = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DDTHH:mm:ssZ' }),
  printf(({ level, message, counter, hash, timestamp }) => {
    const prefix = counter && hash ? `${counter.toString().padEnd(6)} ${hash.padEnd(40)}` : '';

    const timestampPrefix = config.get('@opentermsarchive/engine.logger.timestampPrefix') ? `${timestamp} ` : '';

    return `${timestampPrefix}${level.padEnd(15)} ${prefix.padEnd(50)} ${message}`;
  }),
);

export default logger;
