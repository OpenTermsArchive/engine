/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */

import fsApi from 'fs';
import path from 'path';

// eslint-disable-next-line import/no-extraneous-dependencies
import chai from 'chai';
import config from 'config';
import { createRequire } from 'module';

import fetch from '../../src/fetcher/index.js';
import filter from '../../src/filter/index.js';
import loadServiceDeclarations from '../../src/loader/index.js';
import serviceSchema from './service.schema.js';
import { assertValid, validateDocument } from './validator.js';

const require = createRequire(import.meta.url);
const TYPES = require('../../src/types.json');

const fs = fsApi.promises;
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const { expect } = chai;
const AVAILABLE_TYPE_NAMES = Object.keys(TYPES);
const rootPath = path.join(__dirname, '../..');
const SERVICE_DECLARATIONS_PATH = path.resolve(__dirname, '../../', config.get('serviceDeclarationsPath'));

describe('Services validation', async () => {
  const serviceId = process.argv.slice(process.argv.indexOf('--serviceId'))[1];
  const schemaOnly = process.argv.indexOf('--schema-only') != -1;
  const serviceIds = fsApi.readdirSync(SERVICE_DECLARATIONS_PATH).filter(filename => path.extname(filename) === '.json').map(filename => path.basename(filename, '.json'));
  const servicesToValidate = serviceId ? [ serviceId ] : serviceIds;

  servicesToValidate.forEach(serviceId => {
    let service;

    before(async () => {
      const serviceDeclarations = await loadServiceDeclarations(path.join(rootPath, config.get('serviceDeclarationsPath')));
      service = serviceDeclarations[serviceId];

      if (!service) {
        throw new Error(`There is no service declared with id ${serviceId}`);
      }
    });

    describe(serviceId, () => {
      it('has a valid declaration', async () => {
        const declaration = JSON.parse(await fs.readFile(path.join(rootPath, config.get('serviceDeclarationsPath'), `${serviceId}.json`)));
        assertValid(serviceSchema, declaration);
      });

      if (!schemaOnly) {
        AVAILABLE_TYPE_NAMES.forEach(type => {
          describe(type, () => {
            let validationResults;
            before(async function () {
              this.timeout(11000); // should be longer than the timeout built into validateDocument

              if (!service.documents[type]) {
                console.log('      (Tests skipped for this document type as it is not declared for this service)');
                this.skip();
              }
              validationResults = await validateDocument(service.documents[type]);
            });

            it('has fetchable URL', async function () {
              expect(validationResults.fetchable).to.be.true;
            });

            it('has a selector that matches an element in the web page', async function () {
              expect(validationResults.selectorMatchesAnElement).to.be.true;
            });

            it('has consistent filtered content', async function () {
              expect(validationResults.hasConsistentFilteredContent).to.be.true;
            });
          });
        });
      }
    });
  });
});
