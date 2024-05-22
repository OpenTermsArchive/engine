#! /usr/bin/env node
import './env.js';

import { program } from 'commander';
import cron from 'croner';

import { release } from '../scripts/dataset/index.js';
import logger from '../src/logger/index.js';

program
  .name('ota dataset')
  .description('Export the versions dataset into a ZIP file and optionally publish it to GitHub releases')
  .option('-f, --file <filename>', 'file name of the generated dataset')
  .option('-p, --publish', 'publish dataset to GitHub releases on versions repository. Mandatory authentication to GitHub is provided through the `OTA_ENGINE_GITHUB_TOKEN` environment variable')
  .option('-r, --remove-local-copy', 'remove local copy of dataset after publishing. Works only in combination with --publish option')
  .option('--schedule', 'schedule automatic dataset generation');

const { schedule, publish, removeLocalCopy, file: fileName } = program.parse().opts();

const options = {
  fileName,
  shouldPublish: publish,
  shouldRemoveLocalCopy: removeLocalCopy,
};

if (!schedule) {
  await release(options);
} else {
  logger.info('The scheduler is running…');
  logger.info('Dataset will be published every Monday at 08:30 in the timezone of this machine');

  cron('30 8 * * MON', () => release(options));
}
