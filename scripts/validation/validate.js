import fsApi from 'fs';
import path from 'path';

import Ajv from 'ajv';
import chai from 'chai';
import config from 'config';
import jsonSourceMap from 'json-source-map';
import { createRequire } from 'module';

import fetch from '../../src/fetcher/index.js';
import filter from '../../src/filter/index.js';
import loadServiceDeclarations from '../../src/loader/index.js';
import serviceSchema from './service.schema.js';

const require = createRequire(import.meta.url);
const TYPES = require('../../src/types.json');

const fs = fsApi.promises;
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const { expect } = chai;
const AVAILABLE_TYPE_NAMES = Object.keys(TYPES);
const rootPath = path.join(__dirname, '../..');
const SERVICE_DECLARATIONS_PATH = path.resolve(__dirname, '../../', config.get('serviceDeclarationsPath'));
const MIN_DOC_LENGTH = 100;

describe('Services validation', async () => {
  const serviceId = process.argv.slice(process.argv.indexOf('--serviceId'))[1];
  const schemaOnly = process.argv.indexOf('--schema-only') != -1;
  const serviceIds = fsApi.readdirSync(SERVICE_DECLARATIONS_PATH).filter(filename => path.extname(filename) === '.json').map(filename => path.basename(filename, '.json'));
  const servicesToValidate = serviceId ? [ serviceId ] : serviceIds;
  let serviceDeclarations;

  before(async () => {
    serviceDeclarations = await loadServiceDeclarations(path.join(rootPath, config.get('serviceDeclarationsPath')));
  });

  servicesToValidate.forEach(serviceId => {
    let service;

    before(async () => {
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
            let content;
            let filteredContent;

            before(function () {
              if (!service.documents[type]) {
                console.log('      (Tests skipped for this document type as it is not declared for this service)');
                this.skip();
              }
            });

            it('has fetchable URL', async function () {
              this.timeout(10000);

              const { fetch: location } = service.documents[type];
              content = await fetch(location);
            });

            it('has a selector that matches an element in the web page', async function () {
              if (!content) {
                console.log('      (Tests skipped as url is not fetchable)');
                this.skip();
              }

              filteredContent = await filter(content, service.documents[type], service.filters);
              expect(filteredContent).to.not.be.empty;
            });

            it(`has a resulting filtered content with at least ${MIN_DOC_LENGTH}`, async function () {
              if (!content) {
                console.log('      (Tests skipped as url is not fetchable)');
                this.skip();
              }

              if (!filteredContent) {
                console.log('      (Tests skipped as content cannot be filtered)');
                this.skip();
              }

              expect(filteredContent.length).to.be.greaterThan(MIN_DOC_LENGTH);
            });

            context('When fetched and filtered twice in a row', () => {
              it('has consistent filtered content', async function () {
                if (!content) {
                  console.log('      (Tests skipped as url is not fetchable)');
                  this.skip();
                }

                if (!filteredContent) {
                  console.log('      (Tests skipped as content cannot be filtered)');
                  this.skip();
                }

                this.timeout(10000);

                const { fetch: location } = service.documents[type];
                const secondContent = await fetch(location);
                const secondFilteredContent = await filter(secondContent, service.documents[type], service.filters);

                expect(secondFilteredContent).to.equal(filteredContent);
              });
            });
          });
        });
      }
    });
  });
});

const validator = new Ajv({
  allErrors: true,
  jsonPointers: true,
});

function assertValid(schema, subject) {
  const valid = validator.validate(schema, subject);

  if (!valid) {
    const errorPointers = new Set();
    let errorMessage = '';
    const sourceMap = jsonSourceMap.stringify(subject, null, 2);
    const jsonLines = sourceMap.json.split('\n');
    validator.errors.forEach(error => {
      errorMessage += `\n\n${validator.errorsText([error])}`;
      const errorPointer = sourceMap.pointers[error.dataPath];
      if (errorPointer) {
        errorMessage += `\n> ${jsonLines.slice(errorPointer.value.line, errorPointer.valueEnd.line).join('\n> ')}`;
        errorPointers.add(errorPointer);
      } else {
        errorMessage += ' (in entire file)\n';
      }
    });

    errorMessage += `\n\n${errorPointers.size} features have errors in total`;

    throw new Error(errorMessage);
  }
}
