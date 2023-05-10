import winston from 'winston';
import 'winston-mail';

const { combine, timestamp, printf, colorize } = winston.format;

const transports = [new winston.transports.Console()];

const logger = winston.createLogger({
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    printf(({ level, message, timestamp }) => `${timestamp} ${level.padEnd(15)} ${message}`),
  ),
  transports,
  rejectionHandlers: transports,
});

export default logger;
