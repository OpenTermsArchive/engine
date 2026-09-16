#! /usr/bin/env node
import './env.js';

import { program } from 'commander';
import config from 'config';
import { Cron } from 'croner';
import cronstrue from 'cronstrue';

import { release } from '../scripts/dataset/index.js';
import logger from '../src/logger/index.js';

program
  .name('ota dataset')
  .description('Export the versions dataset into a ZIP file stored locally and optionally publish it to GitHub releases, GitLab releases, or data.gouv.fr')
  .option('-f, --file <filename>', 'file name of the generated dataset')
  .option('-p, --publish', 'publish dataset. Supports GitHub releases (OTA_ENGINE_GITHUB_TOKEN), GitLab releases (OTA_ENGINE_GITLAB_TOKEN), or data.gouv.fr (OTA_ENGINE_DATAGOUV_API_KEY + config)')
  .option('--schedule', 'schedule automatic dataset generation');

const { schedule, publish, file: fileName } = program.parse().opts();

const options = {
  fileName,
  shouldPublish: publish,
};

if (!schedule) {
  await release(options);
} else {
  const trackingSchedule = config.get('@opentermsarchive/engine.dataset.publishingSchedule');
  const humanReadableSchedule = cronstrue.toString(trackingSchedule);

  logger.info('The scheduler is running…');
  logger.info(`Dataset will be published ${humanReadableSchedule.toLowerCase()} in the timezone of this machine`);

  new Cron(trackingSchedule, { catch: error => logger.error(`Dataset release failed: ${error.stack}`) }, () => release(options)); // eslint-disable-line no-new
}
