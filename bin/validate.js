#! /usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';

import Mocha from 'mocha';

const mocha = new Mocha({});
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VALIDATE_PATH = path.resolve(__dirname, '../scripts/validation/validate.js');

(async () => {
  mocha.delay();
  mocha.addFile(VALIDATE_PATH);
  await mocha.loadFilesAsync();

  let hasFailedTests = false;

  mocha.run()
    .on('fail', () => { hasFailedTests = true; })
    .on('end', () => {
      if (hasFailedTests) {
        process.exit(1);
      }
    });
})();
