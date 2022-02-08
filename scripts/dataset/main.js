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

  const RELEASE_HOURS_INTERVAL = 24 * 7;

  logger.info(`A release will be published every ${RELEASE_HOURS_INTERVAL} hours\n`);

  setInterval(async () => {
    logger.info('Start creating the release…');
    await release({ publicationEnabled, removeLocalCopyEnabled, fileName })();
    logger.info('Release published');
  }, RELEASE_HOURS_INTERVAL * 60 * 60 * 1000);
})();
