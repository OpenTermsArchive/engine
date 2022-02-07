import scheduler from 'node-schedule';

import logger from './logger/index.js';

import { release } from './index.js';

(async () => {
  const args = process.argv.slice(2);
  const publicationEnabled = args.includes('--publish');
  const removeLocalCopyEnabled = args.includes('--remove-local-copy');
  const scheduleEnable = args.includes('--schedule');
  const argsWithoutOptions = args.filter(arg => !arg.startsWith('--'));
  const [fileName] = argsWithoutOptions;

  if (removeLocalCopyEnabled && !publicationEnabled) {
    logger.warn('--remove-local-copy is only available with --publish option');
  }

  if (!scheduleEnable) {
    return release({ publicationEnabled, removeLocalCopyEnabled, fileName });
  }

  logger.info('Release will be created every Monday at 03h30');

  scheduler.scheduleJob({ hour: 3, minute: 30, dayOfWeek: 1 }, async () => release({ publicationEnabled, removeLocalCopyEnabled, fileName }));
})();
