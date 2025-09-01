import fsApi from 'fs';
import path from 'path';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { expect } from 'chai';
import config from 'config';
import jsonSourceMap from 'json-source-map';

import * as exposedFilters from '../../../src/archivist/extract/exposedFilters.js';
import extract from '../../../src/archivist/extract/index.js';
import fetch, { launchHeadlessBrowser, stopHeadlessBrowser } from '../../../src/archivist/fetcher/index.js';
import * as services from '../../../src/archivist/services/index.js';
import DeclarationUtils from '../utils/index.js';

import serviceHistorySchema from './service.history.schema.js';
import serviceSchema from './service.schema.js';

const fs = fsApi.promises;

const MIN_DOC_LENGTH = 100;
const SLOW_DOCUMENT_THRESHOLD = 10 * 1000; // number of milliseconds after which a document fetch is considered slow

const instancePath = path.resolve(process.cwd(), config.get('@opentermsarchive/engine.collectionPath'));
const declarationsPath = path.resolve(instancePath, services.DECLARATIONS_PATH);

export default async options => {
  const schemaOnly = options.schemaOnly || false;
  let servicesToValidate = options.services || [];
  const termsTypes = options.types || [];
  let servicesTermsTypes = {};

  const serviceDeclarations = await services.loadWithHistory(servicesToValidate);

  if (!servicesToValidate.length) {
    servicesToValidate = Object.keys(serviceDeclarations);
  }

  if (options.modified) {
    const declarationUtils = new DeclarationUtils(instancePath);

    ({ services: servicesToValidate, servicesTermsTypes } = await declarationUtils.getModifiedServicesAndTermsTypes());
  }

  describe('Service declarations validation', function () {
    this.timeout(60000);
    this.slow(SLOW_DOCUMENT_THRESHOLD);

    servicesToValidate.forEach(serviceId => {
      const service = serviceDeclarations[serviceId];
      const filePath = path.join(declarationsPath, `${serviceId}.json`);
      const historyFilePath = path.join(declarationsPath, `${serviceId}.history.json`);

      before(launchHeadlessBrowser);

      after(stopHeadlessBrowser);

      context(serviceId, () => {
        before(function () {
          if (!service) {
            console.log('      (Tests skipped as declaration has been archived)');
            this.skip();
          }
        });

        it('valid declaration schema', async () => {
          const declaration = JSON.parse(await fs.readFile(filePath));

          assertValid(serviceSchema, declaration);
        });

        if (service && service.hasHistory()) {
          it('valid history declaration schema', async () => {
            const declarationHistory = JSON.parse(await fs.readFile(historyFilePath));

            assertValid(serviceHistorySchema, declarationHistory);
          });
        }

        it('filters do not use reserved names', async () => {
          const filtersFilePath = path.join(declarationsPath, `${serviceId}.filters.js`);

          if (!fsApi.existsSync(filtersFilePath)) {
            return; // Skip if no filters file exists
          }

          const serviceFilters = await services.loadServiceFilters(serviceId);
          const reservedFilterNames = Object.keys(exposedFilters);
          const serviceFilterNames = Object.keys(serviceFilters);

          const conflictingNames = serviceFilterNames.filter(name => reservedFilterNames.includes(name));

          if (conflictingNames.length) {
            throw new Error(`Service filter file "${serviceId}.filters.js" declares filters with engine reserved names: "${conflictingNames.join('", "')}".`);
          }
        });

        if (!schemaOnly && service) {
          service.getTermsTypes()
            .filter(termsType => {
              if (!service.terms[termsType]?.latest) { // If this terms type has been deleted and there is only a historical record for it, but no current valid declaration
                return false;
              }

              if (servicesTermsTypes[serviceId] && servicesTermsTypes[serviceId].length > 0) {
                return servicesTermsTypes[serviceId].includes(termsType);
              }

              if (termsTypes.length > 0) {
                return termsTypes.includes(termsType);
              }

              return true;
            })
            .forEach(type => {
              describe(type, () => {
                const terms = service.getTerms({ type });

                terms.sourceDocuments.forEach(sourceDocument => {
                  let filteredContent;

                  context(sourceDocument.location, () => {
                    before(function () {
                      if (!terms) {
                        console.log('      (Tests skipped as declaration has been archived)');
                        this.skip();
                      }
                    });

                    it('fetchable URL', async () => {
                      const { location, executeClientScripts } = sourceDocument;

                      ({ content: sourceDocument.content, mimeType: sourceDocument.mimeType } = await fetch({
                        url: location,
                        executeClientScripts,
                        cssSelectors: sourceDocument.cssSelectors,
                        config: config.get('@opentermsarchive/engine.fetcher'),
                      }));
                    });

                    it('selector matches an element in the source document', async function checkSelector() {
                      if (!sourceDocument.content) {
                        console.log('          [Tests skipped as URL is not fetchable]');
                        this.skip();
                      }

                      filteredContent = await extract(sourceDocument);

                      expect(filteredContent).to.not.be.empty;
                    });

                    it(`filtered content has at least ${MIN_DOC_LENGTH} characters`, function checkContentLength() {
                      if (!sourceDocument.content) {
                        console.log('          [Tests skipped as URL is not fetchable]');
                        this.skip();
                      }

                      if (!filteredContent) {
                        console.log('          [Tests skipped as content cannot be filtered]');
                        this.skip();
                      }

                      expect(filteredContent.length).to.be.greaterThan(MIN_DOC_LENGTH);
                    });

                    it('content is consistent when fetched and filtered twice in a row', async function checkContentConsistency() {
                      this.slow(SLOW_DOCUMENT_THRESHOLD * 2);

                      if (!sourceDocument.content) {
                        console.log('          [Tests skipped as URL is not fetchable]');
                        this.skip();
                      }

                      if (!filteredContent) {
                        console.log('          [Tests skipped as content cannot be filtered]');
                        this.skip();
                      }

                      ({ content: sourceDocument.content, mimeType: sourceDocument.mimeType } = await fetch({
                        url: sourceDocument.location,
                        executeClientScripts: sourceDocument.executeClientScripts,
                        cssSelectors: sourceDocument.cssSelectors,
                        config: config.get('@opentermsarchive/engine.fetcher'),
                      }));
                      const secondFilteredContent = await extract(sourceDocument);

                      expect(secondFilteredContent).to.equal(filteredContent);
                    });
                  });
                });
              });
            });
        }
      });
    });
  });

  run();
};

const validator = new Ajv({ allErrors: true });

addFormats(validator);

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
        errorMessage += `\n> ${jsonLines
          .slice(errorPointer.value.line, errorPointer.valueEnd.line)
          .join('\n> ')}`;
        errorPointers.add(errorPointer);
      } else {
        errorMessage += ' (in entire file)\n';
      }
    });

    errorMessage += `\n\n${errorPointers.size} features have errors in total`;

    throw new Error(errorMessage);
  }
}
