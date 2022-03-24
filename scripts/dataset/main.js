import cron from 'croner';

import logger from './logger/index.js';

import { release } from './index.js';

const args = process.argv.slice(2);
const argsWithoutOptions = args.filter(arg => !arg.startsWith('--'));
const [fileName] = argsWithoutOptions;
const shouldSchedule = args.includes('--schedule');

const options = {
  fileName,
  shouldPublish: args.includes('--publish'),
  shouldRemoveLocalCopy: args.includes('--remove-local-copy'),
};

if (!shouldSchedule) {
  release(options);
} else {
  logger.info('The scheduler is running…');
  logger.info('Dataset will be published at 08:30 on every Monday');

  cron('30 8 * * MON', () => release(options));
}
