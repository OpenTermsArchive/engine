#! /usr/bin/env node
import './env.js';

import path from 'path';
import { fileURLToPath } from 'url';

import { program } from 'commander';
import Mocha from 'mocha';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VALIDATE_TEST_FILEPATH = '../scripts/declarations/validate/index.mocha.js';
const VALIDATE_PATH = path.resolve(__dirname, VALIDATE_TEST_FILEPATH);

// Mocha catches unhandled rejection from the user code and re-emits them to the process (see https://github.com/mochajs/mocha/blob/master/lib/runner.js#L198)
process.on('unhandledRejection', reason => {
  // Re-throw them so that the validation command fails in these cases (for example, if there is a syntax error when parsing JSON declaration files)
  throw reason;
});

program
  .name('ota validate')
  .description('Run a series of tests to check the validity of document declarations')
  .option('-s, --services [serviceId...]', 'service IDs of services to validate')
  .option('-t, --terms-types [termsType...]', 'terms types to validate')
  .option('-m, --modified', 'target only services modified in the current git branch')
  .option('-o, --schema-only', 'much faster check of declarations, but does not check that the documents are actually accessible');

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

  const generateValidationTestSuite = (await import(VALIDATE_TEST_FILEPATH)).default;

  generateValidationTestSuite(program.parse().opts());

  mocha.run()
    .on('fail', () => { hasFailedTests = true; })
    .on('end', () => {
      if (hasFailedTests) {
        process.exit(1);
      }

      process.exit(0);
    });
})();
