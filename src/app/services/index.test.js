import chai from 'chai';
import chaiExclude from 'chai-exclude';

import * as services from './index.js';

import expectedServices from '../../../test/fixtures/services.js';

chai.use(chaiExclude);
const { expect } = chai;

describe('Services', () => {
  describe('#load', () => {
    let result;

    async function validateServiceWithoutHistory(serviceId, expected) {
      it('has the proper structure', () => {
        expect(result[serviceId]).excludingEvery([ 'filters', '_history' ]).to.deep.equal(expected);
      });

      /* eslint-disable no-loop-func */
      for (const documentType of expected.getDocumentTypes()) {
        it('has no history', () => {
          const { _history: actualHistory } = result[serviceId].getDocument(documentType);
          expect(actualHistory).to.be.undefined;
        });

        const { filters: expectedFilters } = expected.getDocument(documentType);
        if (expectedFilters) {
          for (let indexFilter = 0; indexFilter < expectedFilters.length; indexFilter++) {
            it(`has the proper "${expectedFilters[indexFilter].name}" filter function`, async () => {
              const { filters: actualFilters } = result[serviceId].getDocument(documentType);
              expect(await actualFilters[indexFilter]()).equal(await expectedFilters[indexFilter]()); // eslint-disable-line no-await-in-loop
            });
          }
        } else {
          it('has no filters', () => {
            const { filters: actualFilters } = result[serviceId].getDocument(documentType);
            expect(actualFilters).to.be.undefined;
          });
        }
      }
      /* eslint-enable no-loop-func */
    }

    before(async () => { result = await services.load(); });

    describe('Service A', async () => {
      await validateServiceWithoutHistory('service_A', expectedServices.service_A);
    });

    describe('Service B', async () => {
      await validateServiceWithoutHistory('service_B', expectedServices.service_B);
    });

    context('when a service has no history', async () => {
      describe('service_without_history', async () => {
        await validateServiceWithoutHistory('service_without_history', expectedServices.service_without_history);
      });
    });
    context('when a service has only delcarations history', async () => {
      describe('service_with_declaration_history', async () => {
        await validateServiceWithoutHistory('service_with_declaration_history', expectedServices.service_with_declaration_history);
      });
    });
    context('when a service has only filters history', async () => {
      describe('service_with_filters_history', async () => {
        await validateServiceWithoutHistory('service_with_filters_history', expectedServices.service_with_filters_history);
      });
    });
    context('when a service has both filters and delcarations histories', async () => {
      describe('service_with_history', async () => {
        await validateServiceWithoutHistory('service_with_history', expectedServices.service_with_history);
      });
    });
  });

  describe('#loadWithHistory', () => {
    let result;

    async function validateServiceWithHistory(serviceId, expected) {
      it('has the proper structure', () => {
        expect(result[serviceId]).excludingEvery('filters').to.deep.equal(expected);
      });

      /* eslint-disable no-loop-func */
      for (const documentType of expected.getDocumentTypes()) {
        context(`for "${documentType}"`, () => {
          const { _history: expectedHistory } = expected._documents[documentType];
          const expectedHistoryDates = expectedHistory && expectedHistory.map(entry => entry.validUntil);

          if (expectedHistoryDates) {
            for (const date of expectedHistoryDates) {
              context(`for "${date}" history entry`, () => {
                const expectedDocument = expected.getDocument(documentType, date);
                if (expectedDocument.filters) {
                  it('has the proper number of filter functions', async () => {
                    const actualDocument = result[serviceId].getDocument(documentType, date);
                    expect(actualDocument.filters.length).to.equal(expectedDocument.filters.length);
                  });

                  for (let indexFilter = 0; indexFilter < expectedDocument.filters.length; indexFilter++) {
                    it(`has the proper "${expectedDocument.filters[indexFilter].name}" filter function`, async () => {
                      const actualDocument = result[serviceId].getDocument(documentType, date);
                      expect(await actualDocument.filters[indexFilter]()).equal(await expectedDocument.filters[indexFilter]()); // eslint-disable-line no-await-in-loop
                    });
                  }
                } else {
                  it('has no filters', () => {
                    const actualDocument = result[serviceId].getDocument(documentType, date);
                    expect(actualDocument.filters).to.be.undefined;
                  });
                }
              });
            }
          } else {
            it('has no history', async () => {
              const { _history } = result[serviceId]._documents[documentType];
              expect(_history).to.be.undefined;
            });
            const expectedDocument = expected.getDocument(documentType);
            if (expectedDocument.filters) {
              it('has the proper number of filter functions', async () => {
                const actualDocument = result[serviceId].getDocument(documentType);
                expect(actualDocument.filters.length).to.equal(expectedDocument.filters.length);
              });

              for (let indexFilter = 0; indexFilter < expectedDocument.filters.length; indexFilter++) {
                it(`has the proper "${expectedDocument.filters[indexFilter].name}" filter function`, async () => {
                  const actualDocument = result[serviceId].getDocument(documentType);
                  expect(await actualDocument.filters[indexFilter]()).equal(await expectedDocument.filters[indexFilter]()); // eslint-disable-line no-await-in-loop
                });
              }
            } else {
              it('has no filters', () => {
                const actualDocument = result[serviceId].getDocument(documentType);
                expect(actualDocument.filters).to.be.undefined;
              });
            }
          }
        });
      }
      /* eslint-enable no-loop-func */
    }

    before(async () => { result = await services.loadWithHistory(); });

    describe('Service A', async () => {
      await validateServiceWithHistory('service_A', expectedServices.service_A);
    });

    describe('Service B', async () => {
      await validateServiceWithHistory('service_B', expectedServices.service_B);
    });

    context('when a service has no history', async () => {
      describe('service_without_history', async () => {
        await validateServiceWithHistory('service_without_history', expectedServices.service_without_history);
      });
    });
    context('when a service has only delcarations history', async () => {
      describe('service_with_declaration_history', async () => {
        await validateServiceWithHistory('service_with_declaration_history', expectedServices.service_with_declaration_history);
      });
    });
    context('when a service has only filters history', async () => {
      describe('service_with_filters_history', async () => {
        await validateServiceWithHistory('service_with_filters_history', expectedServices.service_with_filters_history);
      });
    });
    context('when a service has both filters and delcarations histories', async () => {
      describe('service_with_history', async () => {
        await validateServiceWithHistory('service_with_history', expectedServices.service_with_history);
      });
    });
  });
});
