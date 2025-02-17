#! /usr/bin/env node
import './env.js';
import path from 'path';
import { fileURLToPath } from 'url';

import { program } from 'commander';
import Mocha from 'mocha';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createMocha({ delay = false, reporter = 'spec' } = {}) {
  return new Mocha({
    delay,
    failZero: true,
    reporter,
  });
}

export async function runMochaTests(mocha, testPath) {
  try {
    mocha.addFile(testPath); // With `delay` option, this statement will not load the file directly, `loadFilesAsync` is required.
    await mocha.loadFilesAsync(); // Load files previously added to the Mocha cache with `addFile`.

    return new Promise(resolve => {
      let hasFailedTests = false;

      mocha.run()
        .on('fail', () => { hasFailedTests = true; })
        .on('end', () => { resolve(hasFailedTests ? 1 : 0); });
    });
  } catch (error) {
    console.error('Error running tests:', error);

    return 2;
  }
}

process.on('unhandledRejection', reason => { // Mocha catches unhandled rejection from the user code and re-emits them to the process
  throw reason; // Re-throw them so that the validation command fails in these cases (for example, if there is a syntax error when parsing JSON declaration files)
});

program
  .name('ota validate')
  .description('Validate terms declarations and metadata files');

program.command('declarations')
  .description('Run a series of tests to check the validity of terms declarations')
  .option('-s, --services [serviceId...]', 'service IDs of services to validate')
  .option('-t, --types [termsType...]', 'terms types to validate')
  .option('-m, --modified', 'target only services modified in the current git branch')
  .option('-o, --schema-only', 'much faster check of declarations, but does not check that the documents are actually accessible')
  .action(async options => {
    const VALIDATE_TEST_FILEPATH = '../scripts/declarations/validate/index.mocha.js';
    const VALIDATE_PATH = path.resolve(__dirname, VALIDATE_TEST_FILEPATH);

    const mocha = createMocha({ delay: true }); // as the validation script performs an asynchronous load before running the tests, the execution of the tests are delayed until run() is called
    const generateValidationTestSuite = (await import(VALIDATE_TEST_FILEPATH)).default;

    generateValidationTestSuite(options);

    const exitCode = await runMochaTests(mocha, VALIDATE_PATH);

    process.exit(exitCode);
  });

program.command('metadata')
  .description('Validate the metadata file structure')
  .action(async () => {
    const VALIDATE_TEST_FILEPATH = '../scripts/metadata/index.mocha.js';
    const VALIDATE_PATH = path.resolve(__dirname, VALIDATE_TEST_FILEPATH);

    const mocha = createMocha();
    const exitCode = await runMochaTests(mocha, VALIDATE_PATH);

    process.exit(exitCode);
  });

program.parse();
