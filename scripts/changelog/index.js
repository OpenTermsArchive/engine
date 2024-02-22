#! /usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { program } from 'commander';

import { checkChangelog, updateChangelog, extractReleaseType } from './changelog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

program
  .name('changelog')
  .description('<---------------------------------------- TODO ------------------------>')
  .option('--validate', '<---------------------------------------- TODO ------------------------>')
  .option('--update', '<---------------------------------------- TODO ------------------------>')
  .option('--get-release-type', 'Get release type');

const options = program.parse(process.argv).opts();

if (options.validate) {
  const changelogContent = await fs.readFile(path.resolve(__dirname, '../../CHANGELOG.md'), 'UTF-8');

  checkChangelog(changelogContent);
}

if (options.update) {
  const changelogContent = await fs.readFile(path.resolve(__dirname, '../../CHANGELOG.md'), 'UTF-8');

  const updatedChangelog = updateChangelog(changelogContent, 9999);

  await fs.writeFile(path.resolve(__dirname, '../../CHANGELOG.md'), updatedChangelog, 'UTF-8');
}

if (options.getReleaseType) {
  const changelogContent = await fs.readFile(path.resolve(__dirname, '../../CHANGELOG.md'), 'UTF-8');

  const releaseType = extractReleaseType(changelogContent);

  process.stdout.write(releaseType);
}
