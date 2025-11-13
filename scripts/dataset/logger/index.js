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

    const levelStr = level.padEnd(15);
    let coloredLevel = levelStr;
    let coloredMessage = message;

    if (level.includes('warn')) {
      coloredLevel = `\x1b[33m${levelStr}\x1b[0m`;
      coloredMessage = `\x1b[33m${message}\x1b[0m`;
    } else if (level.includes('error')) {
      coloredLevel = `\x1b[31m${levelStr}\x1b[0m`;
      coloredMessage = `\x1b[31m${message}\x1b[0m`;
    }

    return `${timestampPrefix} ${coloredLevel} ${prefix.padEnd(50)} ${coloredMessage}`;
  }),
);

export default logger;
