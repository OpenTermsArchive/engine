#! /usr/bin/env node
import './env.js';

import { program } from 'commander';
import cron from 'croner';

import { release } from '../scripts/dataset/index.js';
import logger from '../src/logger/index.js';

program
  .name('ota dataset')
  .description('Export the versions dataset into a ZIP file and publish it to GitHub releases')
  .option('-f, --fileName <fileName>', 'file name of the generated dataset')
  .option('-p, --publish', 'publish dataset to GitHub releases on versions repository')
  .option('-t, --removeLocalCopy', 'remove local copy of dataset. Works only in combination with --publish option')
  .option('--schedule', 'schedule automatic dataset generation');

const { schedule, publish, removeLocalCopy, fileName } = program.parse().opts();

const options = {
  fileName,
  shouldPublish: publish,
  shouldRemoveLocalCopy: removeLocalCopy,
};

if (!schedule) {
  await release(options);
} else {
  logger.info('The scheduler is running…');
  logger.info('Dataset will be published at 08:30 on every Monday');

  cron('30 8 * * MON', () => release(options));
}
