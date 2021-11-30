#! /usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';

import Mocha from 'mocha';

const mocha = new Mocha({});
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VALIDATE_PATH = path.resolve(__dirname, '../scripts/validation/validate.js');

(async () => {
  mocha.delay(); // As the validation script performs an asynchronous load before running the tests, the execution of the tests must be delayed. It works in addition to the `run` instruction after the loading has been done in the validation script.
  mocha.addFile(VALIDATE_PATH); // As `delay` has been called, this statement will not load the file directly, `loadFilesAsync` is required.
  await mocha.loadFilesAsync(); // Load files previously added to the Mocha cache with `addFile`.

  let hasFailedTests = false;

  mocha.run()
    .on('fail', () => { hasFailedTests = true; })
    .on('end', () => {
      if (hasFailedTests) {
        process.exitCode = 1;
      }
    });
})();
