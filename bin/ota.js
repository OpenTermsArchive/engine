#! /usr/bin/env node
import './.env.js'; // Workaround to ensure `SUPPRESS_NO_CONFIG_WARNING` is set before config is imported

import fs from 'fs';

import { program } from 'commander';

const { description, version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)).toString());

program
  .name('ota')
  .description(description)
  .version(version)
  .command('track', 'Track the current terms of services according to provided declarations')
  .command('declarations', 'Set of utility commands to work on declarations')
  .parse(process.argv);
