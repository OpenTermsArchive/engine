import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const alignedWithColorsAndTime = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ level, message, timestamp }) => `${timestamp} ${level.padEnd(15)} ${message}`),
);

const consoleTransport = new winston.transports.Console();

const transports = [consoleTransport];

const logger = winston.createLogger({
  format: alignedWithColorsAndTime,
  transports,
  rejectionHandlers: transports,
});

export default logger;
