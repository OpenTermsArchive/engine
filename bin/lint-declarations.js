#! /usr/bin/env node
import './.env.js'; // Workaround to ensure `SUPPRESS_NO_CONFIG_WARNING` is set before config is imported

// This tool makes it possible to lint files using the command line either:
// - from OpenTermsArchive core folder, using the existing config
// - from any declaration repository, using a package.json script
// Using this tool also makes it easy to lint all files relative to one service ID, which would have been
// more difficult to achieve using an eslint based command directly defined in the package.json.
// It also ensures that the same version of eslint is used in the OpenTermsArchive core and declarations repositories.

import path from 'path';
import { fileURLToPath } from 'url';

import config from 'config';
import { ESLint } from 'eslint';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = path.resolve(__dirname, '../');
const ESLINT_CONFIG_PATH = path.join(ROOT_PATH, '.eslintrc.yaml');

// Initialise configs to allow clients of this module to use it without requiring node-config in their own application.
// see https://github.com/lorenwest/node-config/wiki/Sub-Module-Configuration
config.util.setModuleDefaults('services', { declarationsPath: path.resolve(process.cwd(), './declarations') });

let servicesToValidate = process.argv.slice(2); // Keep only args that are after the script filename

const DECLARATIONS_PATH = config.get('services.declarationsPath');

(async () => {
  console.log(`Linting files in ${DECLARATIONS_PATH}`);
  const declarationsPath = path.resolve(ROOT_PATH, DECLARATIONS_PATH);

  if (!servicesToValidate.length) {
    servicesToValidate = ['*'];
  }

  for (const service of servicesToValidate) {
    /* eslint-disable no-await-in-loop */
    const lintResults = await new ESLint({ overrideConfigFile: ESLINT_CONFIG_PATH, fix: true }).lintFiles(path.join(declarationsPath, `${service}.*`));

    await ESLint.outputFixes(lintResults);
    console.log(lintResults.map(lintResult => `${path.basename(lintResult.filePath)} linted`).join('\n'));
    /* eslint-enable no-await-in-loop */
  }
})();
