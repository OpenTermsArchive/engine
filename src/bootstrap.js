import logger from './logger/index.js';

process.on('unhandledRejection', (reason) => {
  logger.error(`unhandledRejection ${reason}`);
  logger.error(reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  if (Object.keys(err).includes('smtp')) {
    console.error(
      'This is an smtp error that we do not know how to handle in winston but do not want to track'
    ); // eslint-disable-line
    console.error(
      'We do not use logger.error here because it would potentially retry to send the error by email'
    ); // eslint-disable-line
  } else {
    logger.error(`uncaughtException ${err}`);
    logger.error(Object.keys(err));
    process.exit(1);
  }
});

process.on('SIGTERM', () => {
  logger.error(`Process ${process.pid} received a SIGTERM signal`);
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.error(`Process ${process.pid} has been interrupted`);
  process.exit(0);
});
