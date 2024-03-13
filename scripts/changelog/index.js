#! /usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { program } from 'commander';

import Changelog from './changelog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

program
  .name('changelog')
  .description('A command-line utility for managing the changelog file')
  .option('--validate', 'Validate the changelog, ensuring it follows the expected format and contains required information')
  .option('--release [PRNumber]', 'Convert the Unreleased section into a new release in the changelog, optionally linking to a pull request with the provided PRNumber')
  .option('--clean-unreleased', 'Remove the Unreleased section')
  .option('--get-release-type', 'Get the release type of the Unreleased section in the changelog')
  .option('--get-version-content [version]', 'Get the content of the given version in the changelog');

const options = program.parse(process.argv).opts();

let changelog;

const CHANGELOG_PATH = path.resolve(__dirname, '../../CHANGELOG.md');
const ENCODING = 'UTF-8';

try {
  const changelogContent = await fs.readFile(CHANGELOG_PATH, ENCODING);

  changelog = new Changelog(changelogContent);
} catch (error) {
  console.log(error.message);
}

if (options.validate) {
  changelog.validateUnreleased();
}

if (options.getReleaseType) {
  process.stdout.write(changelog.releaseType || 'No release type found');
}

if (options.getVersionContent) {
  process.stdout.write(changelog.getVersionContent(options.getVersionContent));
}

if (options.release) {
  const PRNumber = typeof options.release == 'boolean' ? null : options.release;

  changelog.release(PRNumber);
  await fs.writeFile(CHANGELOG_PATH, changelog.toString(), ENCODING);
}

if (options.cleanUnreleased) {
  changelog.cleanUnreleased();
  await fs.writeFile(CHANGELOG_PATH, changelog.toString(), ENCODING);
}
