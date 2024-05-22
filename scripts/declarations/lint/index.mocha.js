import fsApi from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { expect } from 'chai';
import config from 'config';
import { ESLint } from 'eslint';

import * as services from '../../../src/archivist/services/index.js';
import DeclarationUtils from '../utils/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = path.resolve(__dirname, '../../../');
const ESLINT_CONFIG_PATH = path.join(ROOT_PATH, '.eslintrc.yaml');

const eslint = new ESLint({ overrideConfigFile: ESLINT_CONFIG_PATH, fix: false });
const eslintWithFix = new ESLint({ overrideConfigFile: ESLINT_CONFIG_PATH, fix: true });

const declarationsPath = path.resolve(process.cwd(), config.get('services.declarationsPath'));
const instancePath = path.resolve(declarationsPath, '../');

export default async options => {
  let servicesToValidate = options.services || [];

  const serviceDeclarations = await services.loadWithHistory(servicesToValidate);

  if (!servicesToValidate.length) {
    servicesToValidate = Object.keys(serviceDeclarations);
  }

  if (options.modified) {
    const declarationUtils = new DeclarationUtils(instancePath);

    ({ services: servicesToValidate } = await declarationUtils.getModifiedServicesAndTermsTypes());
  }

  const lintFile = lintAndFixFile(options.fix);

  describe('Service declarations lint validation', function () {
    this.timeout(30000);

    servicesToValidate.forEach(serviceId => {
      const service = serviceDeclarations[serviceId];
      const filePath = path.join(declarationsPath, `${serviceId}.json`);
      const historyFilePath = path.join(declarationsPath, `${serviceId}.history.json`);
      const filtersFilePath = path.join(declarationsPath, `${serviceId}.filters.js`);
      const filtersHistoryFilePath = path.join(declarationsPath, `${serviceId}.filters.history.js`);

      context(serviceId, () => {
        before(function () {
          if (!service) {
            console.log('      (Tests skipped as declaration has been archived)');
            this.skip();
          }
        });

        it('valid declaration file lint', async () => {
          await lintFile(filePath);
        });

        if (service && service.hasHistory()) {
          it('valid history declaration file lint', async () => {
            await lintFile(historyFilePath);
          });
        }

        if (fsApi.existsSync(filtersFilePath)) {
          it('valid filters file lint', async () => {
            await lintFile(filtersFilePath);
          });
        }

        if (fsApi.existsSync(filtersHistoryFilePath)) {
          it('valid filters history file lint', async () => {
            await lintFile(filtersHistoryFilePath);
          });
        }
      });
    });
  });

  run();
};

const lintAndFixFile = fix => async filePath => {
  // Create a new instance of linter with option `fix` set to true to get a fixed output.
  // It is not possible to use only a linter with this option enabled because when
  // this option is set, if it can fix errors, it considers that there are no errors and returns `0` for the `errorCount`.
  // So use two linters to have access both to `errorCount` and fix `output` variables.
  const [lintResult] = await eslint.lintFiles(filePath);

  if (!lintResult.errorCount) {
    return;
  }

  const [lintResultFixed] = await eslintWithFix.lintFiles(filePath);

  if (fix) {
    await ESLint.outputFixes([lintResultFixed]);

    return lintAndFixFile(false)(filePath);
  }

  expect(lintResult.source).to.equal(lintResultFixed.output, `${path.basename(filePath)} is not properly formatted. Use the lint script to format it correctly.\n`);
};
