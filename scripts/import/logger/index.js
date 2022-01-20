import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const alignedWithColorsAndTime = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ level, message, timestamp, serviceId, type, sha, current, total }) => {
    let prefix = ''.padEnd(8);

    if (current && total) {
      prefix = `${Number(((current) / total) * 100).toFixed(2)}%`.padEnd(8);
    }

    if (serviceId) {
      prefix += `${serviceId}`.padEnd(30);
    }

    if (type) {
      prefix += `${type}`.padEnd(50);
    }

    if (sha) {
      prefix += `${sha}`.padEnd(42);
    } else {
      prefix += ''.padEnd(42);
    }

    return `${timestamp} ${level.padEnd(15)} ${prefix} ${message}`;
  }),
);

const consoleTransport = new winston.transports.Console();

const transports = [consoleTransport];

const logger = winston.createLogger({
  format: alignedWithColorsAndTime,
  transports,
  rejectionHandlers: transports,
});

export default logger;
