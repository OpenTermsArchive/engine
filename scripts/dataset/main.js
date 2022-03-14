import logger from './logger/index.js';

import { release } from './index.js';

const RELEASE_HOURS_INTERVAL = 24;

(() => {
  const args = process.argv.slice(2);
  const shouldPublish = args.includes('--publish');
  const shouldRemoveLocalCopy = args.includes('--remove-local-copy');
  const shouldSchedule = args.includes('--schedule');
  const argsWithoutOptions = args.filter(arg => !arg.startsWith('--'));
  const [fileName] = argsWithoutOptions;

  if (!shouldSchedule) {
    return release({ shouldPublish, shouldRemoveLocalCopy, fileName });
  }

  logger.info(`A release will be published every ${RELEASE_HOURS_INTERVAL} hours\n`);

  setInterval(async () => {
    await release({ shouldPublish, shouldRemoveLocalCopy, fileName });
  }, RELEASE_HOURS_INTERVAL * 60 * 60 * 1000);
})();
