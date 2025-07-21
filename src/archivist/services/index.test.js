import chai from 'chai';
import chaiExclude from 'chai-exclude';

import expectedServices from '../../../test/fixtures/services.js';

import * as services from './index.js';

chai.use(chaiExclude);
const { expect } = chai;

describe('Services', () => {
  describe('#load', () => {
    let result;

    function validateServiceWithoutHistory(serviceId, expected) {
      /* eslint-disable no-loop-func */
      for (const termsType of expected.getTermsTypes()) {
        context(`${termsType}`, () => {
          let actualTerms;
          let actualFilters;
          let actualContentSelectors;
          let actualInsignificantContentSelectors;
          let actualExecuteClientScripts;

          const expectedTerms = expected.getTerms({ type: termsType });

          const { sourceDocuments } = expectedTerms;

          sourceDocuments.forEach((sourceDocument, index) => {
            const {
              filters: expectedFilters,
              contentSelectors: expectedContentSelectors,
              insignificantContentSelectors: expectedInsignificantContentSelectors,
              executeClientScripts: expectedExecuteClientScripts,
            } = sourceDocument;

            context(`source document: ${sourceDocument.id}`, () => {
              before(() => {
                actualTerms = result[serviceId].getTerms({ type: termsType });
                const { sourceDocuments: actualDocuments } = actualTerms;

                ({
                  filters: actualFilters,
                  contentSelectors: actualContentSelectors,
                  insignificantContentSelectors: actualInsignificantContentSelectors,
                  executeClientScripts: actualExecuteClientScripts,
                } = actualDocuments[index]);
              });

              it('has the proper service name', () => {
                expect(actualTerms.service.name).to.eql(expectedTerms.service.name);
              });

              it('has the proper terms type', () => {
                expect(actualTerms.type).to.eql(expectedTerms.type);
              });

              it('has no validity date', () => {
                expect(actualTerms.validUntil).to.be.undefined;
              });

              it('has the proper content selectors', () => {
                expect(actualContentSelectors).to.equal(expectedContentSelectors);
              });

              it('has the proper insignificant content selectors', () => {
                expect(actualInsignificantContentSelectors).to.equal(expectedInsignificantContentSelectors);
              });

              it('has the proper executeClientScripts option', () => {
                expect(actualExecuteClientScripts).to.equal(expectedExecuteClientScripts);
              });

              if (expectedFilters) {
                it('has the proper number of filter functions', () => {
                  expect(actualFilters.length).to.equal(expectedFilters.length);
                });

                for (let indexFilter = 0; indexFilter < expectedFilters.length; indexFilter++) {
                  it(`has the proper "${expectedFilters[indexFilter].name}" filter function`, async () => {
                    expect(await actualFilters[indexFilter]()).equal(await expectedFilters[indexFilter]());
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

    describe('Service·A', async () => {
      await validateServiceWithoutHistory('service·A', expectedServices.service·A);
    });

    describe('Service B', async () => {
      await validateServiceWithoutHistory('Service B!', expectedServices['Service B!']);
    });

    describe('Service without history', async () => {
      await validateServiceWithoutHistory('service_without_history', expectedServices.service_without_history);
    });

    describe('Service with declaration history only', async () => {
      await validateServiceWithoutHistory('service_with_declaration_history', expectedServices.service_with_declaration_history);
    });

    describe('Service with filters history only', async () => {
      await validateServiceWithoutHistory('service_with_filters_history', expectedServices.service_with_filters_history);
    });

    describe('Service with both filters and declarations histories', async () => {
      await validateServiceWithoutHistory('service_with_history', expectedServices.service_with_history);
    });

    describe('Service with terms with multiple source documents', async () => {
      await validateServiceWithoutHistory('service_with_multiple_source_documents_terms', expectedServices.service_with_multiple_source_documents_terms);
    });

    context('when specifying services to load', () => {
      before(async () => {
        result = await services.load([ 'service·A', 'Service B!' ]);
      });

      it('loads only the given services', () => {
        expect(result).to.have.all.keys('service·A', 'Service B!');
      });
    });
  });

  describe('#loadWithHistory', () => {
    let result;

    function validateServiceWithHistory(serviceId, expected) {
      /* eslint-disable no-loop-func */
      for (const termsType of expected.getTermsTypes()) {
        context(`${termsType}`, () => {
          const { history: expectedHistory } = expected.terms[termsType];
          const expectedHistoryDates = expectedHistory && [ ...expectedHistory.map(entry => entry.validUntil), null ]; // add `null` entry to simulate the still current valid declaration

          let actualTerms;
          let actualFilters;
          const expectedTerms = expected.getTerms({ type: termsType });

          const { sourceDocuments } = expectedTerms;

          before(() => {
            actualTerms = result[serviceId].getTerms({ type: termsType });
          });

          it('has the proper service name', () => {
            expect(actualTerms.service.name).to.eql(expectedTerms.service.name);
          });

          it('has the proper terms type', () => {
            expect(actualTerms.type).to.eql(expectedTerms.type);
          });

          sourceDocuments.forEach((sourceDocument, index) => {
            const { filters: expectedFilters } = sourceDocument;

            context(`${sourceDocument.id} sourceDocument`, () => {
              before(() => {
                const { sourceDocuments: actualDocuments } = actualTerms;

                ({ filters: actualFilters } = actualDocuments[index]);
              });

              if (expectedHistoryDates) {
                for (const date of expectedHistoryDates) {
                  context(`${date || 'Current'}`, () => {
                    let actualFiltersForThisDate;
                    let contentSelectorsForThisDate;
                    let insignificantContentSelectorsForThisDate;
                    let actualExecuteClientScriptsForThisDate;

                    const { sourceDocuments: documentsForThisDate } = expected.getTerms({ type: termsType, date });
                    const {
                      filters: expectedFiltersForThisDate,
                      contentSelectors: expectedContentSelectors,
                      insignificantContentSelectors: expectedInsignificantContentSelectors,
                      expectedExecuteClientScripts: expectedExecuteClientScriptsForThisDate,
                    } = documentsForThisDate[index];

                    before(() => {
                      const { sourceDocuments: actualDocumentsForThisDate } = result[serviceId].getTerms({ type: termsType, date });

                      ({
                        filters: actualFiltersForThisDate,
                        contentSelectors: contentSelectorsForThisDate,
                        insignificantContentSelectors: insignificantContentSelectorsForThisDate,
                        expectedExecuteClientScripts: actualExecuteClientScriptsForThisDate,
                      } = actualDocumentsForThisDate[index]);
                    });

                    it('has the proper content selectors', () => {
                      expect(contentSelectorsForThisDate).to.equal(expectedContentSelectors);
                    });

                    it('has the proper insignificant content selectors', () => {
                      expect(insignificantContentSelectorsForThisDate).to.equal(expectedInsignificantContentSelectors);
                    });

                    it('has the proper executeClientScripts option', () => {
                      expect(actualExecuteClientScriptsForThisDate).to.equal(expectedExecuteClientScriptsForThisDate);
                    });

                    if (expectedFiltersForThisDate) {
                      it('has the proper number of filter functions', () => {
                        expect(actualFiltersForThisDate.length).to.equal(expectedFiltersForThisDate.length);
                      });

                      for (let indexFilter = 0; indexFilter < expectedFiltersForThisDate.length; indexFilter++) {
                        it(`has the proper "${expectedFiltersForThisDate[indexFilter].name}" filter function`, async () => {
                          expect(await actualFiltersForThisDate[indexFilter]()).equal(await expectedFiltersForThisDate[indexFilter]());
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
                it('has no history', () => {
                  expect(actualTerms.validUntil).to.be.undefined;
                });

                if (expectedFilters) {
                  it('has the proper number of filter functions', () => {
                    expect(actualFilters.length).to.equal(expectedFilters.length);
                  });

                  for (
                    let indexFilter = 0;
                    indexFilter < expectedFilters.length;
                    indexFilter++
                  ) {
                    it(`has the proper "${expectedFilters[indexFilter].name}" filter function`, async () => {
                      expect(await actualFilters[indexFilter]()).equal(await expectedFilters[indexFilter]());
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

    describe('Service·A', async () => {
      await validateServiceWithHistory('service·A', expectedServices.service·A);
    });

    describe('Service B', async () => {
      await validateServiceWithHistory('Service B!', expectedServices['Service B!']);
    });

    describe('Service without history', async () => {
      await validateServiceWithHistory('service_without_history', expectedServices.service_without_history);
    });

    describe('Service with declaration history only', async () => {
      await validateServiceWithHistory('service_with_declaration_history', expectedServices.service_with_declaration_history);
    });

    describe('Service with filters history only', async () => {
      await validateServiceWithHistory('service_with_filters_history', expectedServices.service_with_filters_history);
    });

    describe('Service with both filters and declarations histories', async () => {
      await validateServiceWithHistory('service_with_history', expectedServices.service_with_history);
    });

    describe('Service with terms with multiple source documents', async () => {
      await validateServiceWithHistory('service_with_multiple_source_documents_terms', expectedServices.service_with_multiple_source_documents_terms);
    });

    context('when specifying services to load', () => {
      before(async () => {
        result = await services.loadWithHistory([ 'service·A', 'Service B!' ]);
      });

      it('loads only the given services', () => {
        expect(result).to.have.all.keys('service·A', 'Service B!');
      });
    });
  });
});
