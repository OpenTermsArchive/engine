#! /usr/bin/env node
import './.env.js'; // Workaround to ensure `SUPPRESS_NO_CONFIG_WARNING` is set before config is imported

import { program } from 'commander';

program
  .name('ota declarations')
  .command('validate', 'Run a series of tests to check the validity of document declarations')
  .command('lint', 'Check format and stylistic errors in declarations and auto fix them')
  .parse(process.argv);
