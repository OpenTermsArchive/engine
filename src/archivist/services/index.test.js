import chai from 'chai';
import chaiExclude from 'chai-exclude';

import expectedServices from '../../../test/fixtures/services.js';

import * as services from './index.js';

chai.use(chaiExclude);
const { expect } = chai;

describe('Services', () => {
  describe('#load', () => {
    let result;

    async function validateServiceWithoutHistory(serviceId, expected) {
      /* eslint-disable no-loop-func */
      for (const termsType of expected.getTermsTypes()) {
        context(`${termsType}`, () => {
          let actualDocumentDeclaration;
          let actualFilters;
          let actualContentSelectors;
          let actualInsignificantContentSelectors;
          let actualExecuteClientScripts;

          const expectedDocumentDeclaration = expected.getTerms(termsType);

          const { sourceDocuments } = expectedDocumentDeclaration;

          sourceDocuments.forEach((sourceDocument, index) => {
            const {
              filters: expectedFilters,
              contentSelectors: expectedContentSelectors,
              insignificantContentSelectors: expectedInsignificantContentSelectors,
              executeClientScripts: expectedExecuteClientScripts,
            } = sourceDocument;

            context(`SourceDocument: ${sourceDocument.id}`, () => {
              before(() => {
                actualDocumentDeclaration = result[serviceId].getTerms(termsType);
                const { sourceDocuments: actualDocuments } = actualDocumentDeclaration;

                ({
                  filters: actualFilters,
                  contentSelectors: actualContentSelectors,
                  insignificantContentSelectors: actualInsignificantContentSelectors,
                  executeClientScripts: actualExecuteClientScripts,
                } = actualDocuments[index]);
              });

              it('has the proper service name', () => {
                expect(actualDocumentDeclaration.service.name).to.eql(expectedDocumentDeclaration.service.name);
              });

              it('has the proper terms type', () => {
                expect(actualDocumentDeclaration.termsType).to.eql(expectedDocumentDeclaration.termsType);
              });

              it('has no validity date', () => {
                expect(actualDocumentDeclaration.validUntil).to.be.undefined;
              });

              it('has the proper content selectors', async () => {
                expect(actualContentSelectors).to.equal(expectedContentSelectors);
              });

              it('has the proper insignificant content selectors', async () => {
                expect(actualInsignificantContentSelectors).to.equal(expectedInsignificantContentSelectors);
              });

              it('has the proper executeClientScripts option', async () => {
                expect(actualExecuteClientScripts).to.equal(expectedExecuteClientScripts);
              });

              if (expectedFilters) {
                it('has the proper number of filter functions', async () => {
                  expect(actualFilters.length).to.equal(expectedFilters.length);
                });

                for (let indexFilter = 0; indexFilter < expectedFilters.length; indexFilter++) {
                  it(`has the proper "${expectedFilters[indexFilter].name}" filter function`, async () => {
                    expect(await actualFilters[indexFilter]()).equal(await expectedFilters[indexFilter]()); // eslint-disable-line no-await-in-loop
                  });
                }
              } else {
                it('has no filters', () => {
                  expect(actualFilters).to.be.undefined;
                });
              }
            });
          });
        });
      }
      /* eslint-enable no-loop-func */
    }

    before(async () => {
      result = await services.load();
    });

    describe('Service A', async () => {
      await validateServiceWithoutHistory('service_A', expectedServices.service_A);
    });

    describe('Service B', async () => {
      await validateServiceWithoutHistory('service_B', expectedServices.service_B);
    });

    context('when a service has no history', async () => {
      describe('Service without history', async () => {
        await validateServiceWithoutHistory('service_without_history', expectedServices.service_without_history);
      });
    });

    context('when a service has only history for declarations', async () => {
      describe('Service with declaration history', async () => {
        await validateServiceWithoutHistory('service_with_declaration_history', expectedServices.service_with_declaration_history);
      });
    });

    context('when a service has only history for filters', async () => {
      describe('Service with filters history', async () => {
        await validateServiceWithoutHistory('service_with_filters_history', expectedServices.service_with_filters_history);
      });
    });

    context('when a service has histories both for filters and for declarations', async () => {
      describe('Service with history', async () => {
        await validateServiceWithoutHistory('service_with_history', expectedServices.service_with_history);
      });
    });

    context('when a service has a multi sourceDocuments terms', async () => {
      describe('Service with a multi sourceDocuments terms', async () => {
        await validateServiceWithoutHistory('service_with_multi_documents_terms', expectedServices.service_with_multi_documents_terms);
      });
    });

    context('when specifying services to load', async () => {
      before(async () => {
        result = await services.load([ 'service_A', 'service_B' ]);
      });

      it('loads only the given services', async () => {
        expect(result).to.have.all.keys('service_A', 'service_B');
      });
    });
  });

  describe('#loadWithHistory', () => {
    let result;

    async function validateServiceWithHistory(serviceId, expected) {
      /* eslint-disable no-loop-func */
      for (const termsType of expected.getTermsTypes()) {
        context(`${termsType}`, () => {
          const { history: expectedHistory } = expected.terms[termsType];
          const expectedHistoryDates = expectedHistory && [ ...expectedHistory.map(entry => entry.validUntil), null ]; // add `null` entry to simulate the still current valid declaration

          let actualDocumentDeclaration;
          let actualFilters;
          const expectedDocumentDeclaration = expected.getTerms(termsType);

          const { sourceDocuments } = expectedDocumentDeclaration;

          before(() => {
            actualDocumentDeclaration = result[serviceId].getTerms(termsType);
          });

          it('has the proper service name', () => {
            expect(actualDocumentDeclaration.service.name).to.eql(expectedDocumentDeclaration.service.name);
          });

          it('has the proper terms type', () => {
            expect(actualDocumentDeclaration.termsType).to.eql(expectedDocumentDeclaration.termsType);
          });

          sourceDocuments.forEach((sourceDocument, index) => {
            const { filters: expectedFilters } = sourceDocument;

            context(`${sourceDocument.id} sourceDocument`, () => {
              before(() => {
                const { sourceDocuments: actualDocuments } = actualDocumentDeclaration;

                ({ filters: actualFilters } = actualDocuments[index]);
              });

              if (expectedHistoryDates) {
                for (const date of expectedHistoryDates) {
                  context(`${date || 'Current'}`, () => {
                    let actualFiltersForThisDate;
                    let contentSelectorsForThisDate;
                    let insignificantContentSelectorsForThisDate;
                    let actualExecuteClientScriptsForThisDate;

                    const { sourceDocuments: documentsForThisDate } = expected.getTerms(termsType, date);
                    const {
                      filters: expectedFiltersForThisDate,
                      contentSelectors: expectedContentSelectors,
                      insignificantContentSelectors: expectedInsignificantContentSelectors,
                      expectedExecuteClientScripts: expectedExecuteClientScriptsForThisDate,
                    } = documentsForThisDate[index];

                    before(() => {
                      const { sourceDocuments: actualDocumentsForThisDate } = result[serviceId].getTerms(termsType, date);

                      ({
                        filters: actualFiltersForThisDate,
                        contentSelectors: contentSelectorsForThisDate,
                        insignificantContentSelectors: insignificantContentSelectorsForThisDate,
                        expectedExecuteClientScripts: actualExecuteClientScriptsForThisDate,
                      } = actualDocumentsForThisDate[index]);
                    });

                    it('has the proper content selectors', async () => {
                      expect(contentSelectorsForThisDate).to.equal(expectedContentSelectors);
                    });

                    it('has the proper insignificant content selectors', async () => {
                      expect(insignificantContentSelectorsForThisDate).to.equal(expectedInsignificantContentSelectors);
                    });

                    it('has the proper executeClientScripts option', async () => {
                      expect(actualExecuteClientScriptsForThisDate).to.equal(expectedExecuteClientScriptsForThisDate);
                    });

                    if (expectedFiltersForThisDate) {
                      it('has the proper number of filter functions', async () => {
                        expect(actualFiltersForThisDate.length).to.equal(expectedFiltersForThisDate.length);
                      });

                      for (let indexFilter = 0; indexFilter < expectedFiltersForThisDate.length; indexFilter++) {
                        it(`has the proper "${expectedFiltersForThisDate[indexFilter].name}" filter function`, async () => {
                          expect(await actualFiltersForThisDate[indexFilter]()).equal(await expectedFiltersForThisDate[indexFilter]()); // eslint-disable-line no-await-in-loop
                        });
                      }
                    } else {
                      it('has no filters', () => {
                        expect(actualFiltersForThisDate).to.be.undefined;
                      });
                    }
                  });
                }
              } else {
                it('has no history', async () => {
                  expect(actualDocumentDeclaration.validUntil).to.be.undefined;
                });

                if (expectedFilters) {
                  it('has the proper number of filter functions', async () => {
                    expect(actualFilters.length).to.equal(expectedFilters.length);
                  });

                  for (
                    let indexFilter = 0;
                    indexFilter < expectedFilters.length;
                    indexFilter++
                  ) {
                    it(`has the proper "${expectedFilters[indexFilter].name}" filter function`, async () => {
                      expect(await actualFilters[indexFilter]()).equal(await expectedFilters[indexFilter]()); // eslint-disable-line no-await-in-loop
                    });
                  }
                } else {
                  it('has no filters', () => {
                    expect(actualFilters).to.be.undefined;
                  });
                }
              }
            });
          });
        });
      }
      /* eslint-enable no-loop-func */
    }

    before(async () => {
      result = await services.loadWithHistory();
    });

    describe('Service A', async () => {
      await validateServiceWithHistory('service_A', expectedServices.service_A);
    });

    describe('Service B', async () => {
      await validateServiceWithHistory('service_B', expectedServices.service_B);
    });

    context('when a service has no history', async () => {
      describe('Service without history', async () => {
        await validateServiceWithHistory('service_without_history', expectedServices.service_without_history);
      });
    });

    context('when a service has only declarations history', async () => {
      describe('Service with declaration history', async () => {
        await validateServiceWithHistory('service_with_declaration_history', expectedServices.service_with_declaration_history);
      });
    });

    context('when a service has only filters history', async () => {
      describe('Service with filters history', async () => {
        await validateServiceWithHistory('service_with_filters_history', expectedServices.service_with_filters_history);
      });
    });

    context('when a service has both filters and declarations histories', async () => {
      describe('Service with history', async () => {
        await validateServiceWithHistory('service_with_history', expectedServices.service_with_history);
      });
    });

    context('when a service has a multi sourceDocuments terms', async () => {
      describe('Service with a multi sourceDocuments terms', async () => {
        await validateServiceWithHistory('service_with_multi_documents_terms', expectedServices.service_with_multi_documents_terms);
      });
    });

    context('when specifying services to load', async () => {
      before(async () => {
        result = await services.loadWithHistory([ 'service_A', 'service_B' ]);
      });

      it('loads only the given services', async () => {
        expect(result).to.have.all.keys('service_A', 'service_B');
      });
    });
  });
});
