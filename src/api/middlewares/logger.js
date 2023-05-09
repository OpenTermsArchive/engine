import morgan from 'morgan';
import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const transports = [new winston.transports.Console()];

export const logger = winston.createLogger({
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    printf(({ level, message, timestamp }) => `${timestamp} ${level.padEnd(15)} ${message}`),
  ),
  transports,
  rejectionHandlers: transports,
});

const middleware = morgan('tiny', { stream: { write: message => logger.info(message.trim()) } });

export default middleware;
