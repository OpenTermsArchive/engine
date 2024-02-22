#! /usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { program } from 'commander';

import Changelog from './changelog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

program
  .name('changelog')
  .description('A command-line utility for managing changelog file')
  .option('--validate', 'Validate the changelog, ensuring it follows the expected format and contains required information')
  .option('--release [PRNumber]', 'Convert the Unreleased section into a new release in the changelog, optionally linking to a pull request with the provided PRNumber')
  .option('--get-release-type', 'Get the release type of the unreleased section in the changelog')
  .option('--get-version-content [version]', 'Get the content of a specific version in the changelog');

const options = program.parse(process.argv).opts();

let changelog;

try {
  const changelogContent = await fs.readFile(path.resolve(__dirname, '../../CHANGELOG.md'), 'UTF-8');

  changelog = new Changelog(changelogContent);
} catch (error) {
  console.log(error.message);
}

if (options.validate) {
  changelog.validateUnreleased();
}

if (options.getReleaseType) {
  process.stdout.write(changelog.getReleaseType() || 'No release type found');
}

if (options.getVersionContent) {
  process.stdout.write(changelog.getVersionContent(options.getVersionContent));
}

if (options.release) {
  const PRNumber = typeof options.release == 'boolean' ? null : options.release;

  changelog.release(PRNumber);
  await fs.writeFile(path.resolve(__dirname, '../../CHANGELOG.md'), changelog.toString(), 'UTF-8');
}
