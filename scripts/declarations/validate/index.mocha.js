import fsApi from 'fs';
import path from 'path';

import Ajv from 'ajv';
import { expect } from 'chai';
import config from 'config';
import jsonSourceMap from 'json-source-map';

import extract from '../../../src/archivist/extract/index.js';
import fetch, { launchHeadlessBrowser, stopHeadlessBrowser } from '../../../src/archivist/fetcher/index.js';
import * as services from '../../../src/archivist/services/index.js';
import DeclarationUtils from '../utils/index.js';

import serviceHistorySchema from './service.history.schema.js';
import serviceSchema from './service.schema.js';

const fs = fsApi.promises;

const MIN_DOC_LENGTH = 100;
const SLOW_DOCUMENT_THRESHOLD = 10 * 1000; // number of milliseconds after which a document fetch is considered slow

const declarationsPath = path.resolve(process.cwd(), config.get('services.declarationsPath'));
const instancePath = path.resolve(declarationsPath, '../');

export default async options => {
  const schemaOnly = options.schemaOnly || false;
  let servicesToValidate = options.services || [];
  const termsTypes = options.termsTypes || [];
  let servicesTermsTypes = {};

  const serviceDeclarations = await services.loadWithHistory(servicesToValidate);

  if (!servicesToValidate.length) {
    servicesToValidate = Object.keys(serviceDeclarations);
  }

  if (options.modified) {
    const declarationUtils = new DeclarationUtils(instancePath);

    ({ services: servicesToValidate, servicesTermsTypes } = await declarationUtils.getModifiedServiceTermsTypes());
  }

  describe('Service declarations validation', async function () {
    this.timeout(30000);
    this.slow(SLOW_DOCUMENT_THRESHOLD);

    servicesToValidate.forEach(serviceId => {
      const service = serviceDeclarations[serviceId];
      const filePath = path.join(declarationsPath, `${serviceId}.json`);
      const historyFilePath = path.join(declarationsPath, `${serviceId}.history.json`);

      before(launchHeadlessBrowser);

      after(stopHeadlessBrowser);

      context(serviceId, async () => {
        before(async function () {
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

        if (!schemaOnly && service) {
          service.getDocumentTypes()
            .filter(termsType => {
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
                const terms = service.getTerms(type);

                terms.sourceDocuments.forEach(sourceDocument => {
                  let content;
                  let filteredContent;
                  let mimeType;

                  context(sourceDocument.location, () => {
                    before(async function () {
                      if (!terms) {
                        console.log('      (Tests skipped as declaration has been archived)');
                        this.skip();
                      }
                    });

                    it('fetchable URL', async () => {
                      const { location, executeClientScripts } = sourceDocument;

                      ({ content, mimeType } = await fetch({
                        url: location,
                        executeClientScripts,
                        cssSelectors: sourceDocument.cssSelectors,
                        config: config.get('fetcher'),
                      }));
                    });

                    it('selector matches an element in the source document', async function checkSelector() {
                      if (!content) {
                        console.log('          [Tests skipped as URL is not fetchable]');
                        this.skip();
                      }

                      filteredContent = await extract({ content, sourceDocument, mimeType });

                      expect(filteredContent).to.not.be.empty;
                    });

                    it(`filtered content has at least ${MIN_DOC_LENGTH} characters`, async function checkContentLength() {
                      if (!content) {
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

                      if (!content) {
                        console.log('          [Tests skipped as URL is not fetchable]');
                        this.skip();
                      }

                      if (!filteredContent) {
                        console.log('          [Tests skipped as content cannot be filtered]');
                        this.skip();
                      }

                      const { content, mimeType } = await fetch({
                        url: sourceDocument.location,
                        executeClientScripts: sourceDocument.executeClientScripts,
                        cssSelectors: sourceDocument.cssSelectors,
                        config: config.get('fetcher'),
                      });
                      const secondFilteredContent = await extract({ content, sourceDocument, mimeType });

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
      console.log('error', error);
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
