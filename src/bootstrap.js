import logger from './logger/index.js';

process.on('unhandledRejection', reason => {
  logger.error(`unhandledRejection ${reason}`);
  logger.error(reason);
  process.exit(1);
});

process.on('uncaughtException', err => {
  logger.error(`uncaughtException ${err}`);
  logger.error(err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.error(`Process ${process.pid} received a SIGTERM signal`);
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.error(`Process ${process.pid} has been interrupted`);
  process.exit(0);
});
