#! /usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { program } from 'commander';

import { checkChangelog, updateChangelog } from './changelog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

program
  .name('changelog')
  .description('<---------------------------------------- TODO ------------------------>')
  .option('--validate', '<---------------------------------------- TODO ------------------------>')
  .option('--update', '<---------------------------------------- TODO ------------------------>');

const options = program.parse(process.argv).opts();

console.log();

if (options.validate) {
  const changelogContent = await fs.readFile(path.resolve(__dirname, '../../CHANGELOG.md'), 'UTF-8');

  checkChangelog(changelogContent);
}

if (options.update) {
  const changelogContent = await fs.readFile(path.resolve(__dirname, '../../CHANGELOG.md'), 'UTF-8');

  const updatedChangelog = updateChangelog(changelogContent, 9999);

  await fs.writeFile(path.resolve(__dirname, '../../CHANGELOG.md'), updatedChangelog, 'UTF-8');
}
