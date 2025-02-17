#! /usr/bin/env node
import './env.js';

import path from 'path';
import { fileURLToPath } from 'url';

import { program } from 'commander';
import Mocha from 'mocha';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LINT_TEST_FILEPATH = '../scripts/declarations/lint/index.mocha.js';
const LINT_PATH = path.resolve(__dirname, LINT_TEST_FILEPATH);

// Mocha catches unhandled rejection from the user code and re-emits them to the process
process.on('unhandledRejection', reason => {
  // Re-throw them so that the validation command fails in these cases (for example, if there is a syntax error when parsing JSON declaration files)
  throw reason;
});

program
  .name('ota lint')
  .description('Check format and stylistic errors in declarations and auto fix them')
  .option('-s, --services [serviceId...]', 'service IDs of services to lint')
  .option('-m, --modified', 'to only lint modified services already commited to git')
  .option('-f, --fix', 'to fix the declarations');

const mocha = new Mocha({
  delay: true, // as the validation script performs an asynchronous load before running the tests, the execution of the tests are delayed until run() is called
  failZero: true, // consider that being called with no service to validate is a failure
});

(async () => {
  mocha.addFile(LINT_PATH); // As `delay` has been called, this statement will not load the file directly, `loadFilesAsync` is required.
  await mocha.loadFilesAsync() // Load files previously added to the Mocha cache with `addFile`.
    .catch(error => {
      console.error(error);
      process.exit(2);
    });

  let hasFailedTests = false;

  const lintFiles = (await import(LINT_TEST_FILEPATH)).default;

  lintFiles(program.parse().opts());

  mocha.run()
    .on('fail', () => { hasFailedTests = true; })
    .on('end', () => {
      if (hasFailedTests) {
        process.exit(1);
      }

      process.exit(0);
    });
})();
