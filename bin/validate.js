#! /usr/bin/env node
import './.env.js'; // Workaround to ensure `SUPPRESS_NO_CONFIG_WARNING` is set before config is imported

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

import config from 'config';
import Mocha from 'mocha';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const defaultConfigs = require(path.resolve(__dirname, '../config/default.json')); // eslint-disable-line import/no-dynamic-require

// Initialise configs to allow clients of this module to use it without requiring node-config in their own application.
// see https://github.com/lorenwest/node-config/wiki/Sub-Module-Configuration
config.util.setModuleDefaults('services', {
  declarationsPath: path.resolve(process.cwd(), './declarations'),
  documentTypesPath: path.resolve(process.cwd(), './document-types.json'),
});
config.util.setModuleDefaults('fetcher', defaultConfigs.fetcher);

const mocha = new Mocha({
  failZero: true, // consider that being called with no service to validate is a failure
});
const VALIDATE_PATH = path.resolve(__dirname, '../scripts/validation/validate.js');

(async () => {
  mocha.delay(); // As the validation script performs an asynchronous load before running the tests, the execution of the tests must be delayed. It works in addition to the `run` instruction after the loading has been done in the validation script.
  mocha.addFile(VALIDATE_PATH); // As `delay` has been called, this statement will not load the file directly, `loadFilesAsync` is required.
  await mocha.loadFilesAsync() // Load files previously added to the Mocha cache with `addFile`.
    .catch(error => {
      console.error(error);
      process.exit(2);
    });

  let hasFailedTests = false;

  mocha.run()
    .on('fail', () => { hasFailedTests = true; })
    .on('end', () => {
      if (hasFailedTests) {
        process.exit(1);
      }

      process.exit(0);
    });
})();
