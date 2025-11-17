#! /usr/bin/env node
import './env.js';

import fs from 'fs';

import { program } from 'commander';

const { description, version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)).toString());

program
  .description(description)
  .version(version)
  .command('track', 'Track the current terms of services according to provided declarations')
  .command('apply-technical-upgrades', 'Apply technical upgrades: regenerate versions from existing snapshots with updated declarations/engine')
  .command('validate', 'Run a series of tests to check the validity of terms declarations')
  .command('lint', 'Check format and stylistic errors in declarations and auto fix them')
  .command('dataset', 'Export the versions dataset into a ZIP file and optionally publish it to GitHub releases')
  .command('serve', 'Start the collection metadata API server')
  .parse(process.argv);
