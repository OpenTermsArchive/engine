import winston from 'winston';

import logger from '../../../src/logger/index.js';

const { combine, timestamp, printf, colorize } = winston.format;

const alignedWithColorsAndTime = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ level, message, counter, hash, timestamp }) => {
    let prefix = '';

    if (counter && hash) {
      prefix = `${counter.toString().padEnd(6)} ${hash.padEnd(40)}`;
    }

    return `${timestamp} ${level.padEnd(15)} ${prefix.padEnd(50)} ${message}`;
  }),
);

logger.format = alignedWithColorsAndTime;

export default logger;
