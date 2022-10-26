#! /usr/bin/env node
import './.env.js'; // Workaround to ensure `SUPPRESS_NO_CONFIG_WARNING` is set before config is imported

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { program } from 'commander';
import config from 'config';
import Mocha from 'mocha';

import addValidationTestSuite from '../scripts/declarations/validate/index.mocha.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const defaultConfigs = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../config/default.json')));

const VALIDATE_PATH = path.resolve(__dirname, '../scripts/declarations/validate/index.mocha.js');

// Mocha catches unhandled rejection from the user code and re-emits them to the process (see https://github.com/mochajs/mocha/blob/master/lib/runner.js#L198)
process.on('unhandledRejection', reason => {
  // Re-throw them so that the validation command fails in these cases (for example, if there is a syntax error when parsing JSON declaration files)
  throw reason;
});

// Initialise configs to allow clients of this module to use it without requiring node-config in their own application.
// see https://github.com/lorenwest/node-config/wiki/Sub-Module-Configuration
config.util.setModuleDefaults('services', { declarationsPath: path.resolve(process.cwd(), './declarations') });
config.util.setModuleDefaults('fetcher', defaultConfigs.fetcher);

const { version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)).toString());

program
  .name('validate declaration files')
  .description('check if document declarations are valid and linted properly')
  .version(version)
  .option('-s, --services [serviceId...]', 'service IDs of services to handle')
  .option('-so, --schema-only', 'only refilter exisiting snapshots with last declarations and engine\'s updates');

const mocha = new Mocha({
  delay: true, // as the validation script performs an asynchronous load before running the tests, the execution of the tests are delayed until run() is called
  failZero: true, // consider that being called with no service to validate is a failure
});

(async () => {
  mocha.addFile(VALIDATE_PATH); // As `delay` has been called, this statement will not load the file directly, `loadFilesAsync` is required.
  await mocha.loadFilesAsync() // Load files previously added to the Mocha cache with `addFile`.
    .catch(error => {
      console.error(error);
      process.exit(2);
    });

  let hasFailedTests = false;

  addValidationTestSuite(program.parse(process.argv).opts());

  mocha.run()
    .on('fail', () => { hasFailedTests = true; })
    .on('end', () => {
      if (hasFailedTests) {
        process.exit(1);
      }

      process.exit(0);
    });
})();
