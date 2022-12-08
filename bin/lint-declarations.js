#! /usr/bin/env node
// makes it easy to lint all files relative to one service ID, which would have been
// more difficult to achieve using an eslint based command directly defined in the package.json.
// It also ensures that the same version of eslint is used in the OpenTermsArchive core and declarations repositories.
import './.env.js'; // Workaround to ensure `SUPPRESS_NO_CONFIG_WARNING` is set before config is imported

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { program } from 'commander';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)).toString());

program
  .name('ota-lint-declarations')
  .description('Check format and stylistic errors in declarations and auto fix them')
  .version(version)
  .option('-s, --services [serviceId...]', 'service IDs of services to handle')
  .option('-m, --modified', 'to only lint modified services already commited to git');

const lintDeclarations = (await import(pathToFileURL(path.resolve(__dirname, '../scripts/declarations/lint/index.js')))).default;

lintDeclarations(program.parse().opts());
