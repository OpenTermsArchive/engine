import logger from './logger/index.js';

import { release } from './index.js';

(async () => {
  const args = process.argv.slice(2);
  const shouldPublish = args.includes('--publish');
  const shouldRemoveLocalCopy = args.includes('--remove-local-copy');
  const shouldSchedule = args.includes('--schedule');
  const argsWithoutOptions = args.filter(arg => !arg.startsWith('--'));
  const [fileName] = argsWithoutOptions;

  if (!shouldSchedule) {
    return release({ shouldPublish, shouldRemoveLocalCopy, fileName });
  }

  const RELEASE_HOURS_INTERVAL = 24 * 7;

  logger.info(`A release will be published every ${RELEASE_HOURS_INTERVAL} hours\n`);

  setInterval(async () => {
    logger.info('Start creating the release…');
    await release({ shouldPublish, shouldRemoveLocalCopy, fileName })();
    logger.info('Release published');
  }, RELEASE_HOURS_INTERVAL * 60 * 60 * 1000);
})();
