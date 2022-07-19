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
      for (const documentType of expected.getDocumentTypes()) {
        context(`${documentType}`, () => {
          let actualDocumentDeclaration;
          let actualFilters;

          const expectedDocumentDeclaration = expected.getDocumentDeclaration(documentType);

          const { pages } = expectedDocumentDeclaration;

          for (const [ index, page ] of pages.entries()) {
            const { filters: expectedFilters } = page;

            context(`Page: ${page.id}`, () => {
              before(() => {
                actualDocumentDeclaration = result[serviceId].getDocumentDeclaration(documentType);
                const { pages: actualPages } = actualDocumentDeclaration;

                ({ filters: actualFilters } = actualPages[index]);
              });

              it('has the proper service name', () => {
                expect(actualDocumentDeclaration.service.name).to.eql(expectedDocumentDeclaration.service.name);
              });

              it('has the proper document type', () => {
                expect(actualDocumentDeclaration.type).to.eql(expectedDocumentDeclaration.type);
              });

              it('has no validity date', () => {
                expect(actualDocumentDeclaration.validUntil).to.be.undefined;
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
          }
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

    context('when a service has a multipage document', async () => {
      describe('Service with a multipage document', async () => {
        await validateServiceWithoutHistory('service_with_multipage_document', expectedServices.service_with_multipage_document);
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
      for (const documentType of expected.getDocumentTypes()) {
        context(`${documentType}`, () => {
          const { history: expectedHistory } = expected.documents[documentType];
          const expectedHistoryDates = expectedHistory && [ ...expectedHistory.map(entry => entry.validUntil), null ]; // add `null` entry to simulate the still current valid declaration

          let actualDocumentDeclaration;
          let actualFilters;
          const expectedDocumentDeclaration = expected.getDocumentDeclaration(documentType);

          const { pages } = expectedDocumentDeclaration;

          before(() => {
            actualDocumentDeclaration = result[serviceId].getDocumentDeclaration(documentType);
          });

          it('has the proper service name', () => {
            expect(actualDocumentDeclaration.service.name).to.eql(expectedDocumentDeclaration.service.name);
          });

          it('has the proper document type', () => {
            expect(actualDocumentDeclaration.type).to.eql(expectedDocumentDeclaration.type);
          });

          for (const [ index, page ] of pages.entries()) {
            const { filters: expectedFilters } = page;

            context(`${page.id} page`, () => {
              before(() => {
                const { pages: actualPages } = actualDocumentDeclaration;

                ({ filters: actualFilters } = actualPages[index]);
              });

              if (expectedHistoryDates) {
                for (const date of expectedHistoryDates) {
                  context(`${date || 'Current'}`, () => {
                    let actualFiltersForThisDate;

                    const { pages: pagesForThisDate } = expected.getDocumentDeclaration(documentType, date);
                    const { filters: expectedFiltersForThisDate } = pagesForThisDate[index];

                    before(() => {
                      const { pages: actualPagesForThisDate } = result[serviceId].getDocumentDeclaration(documentType, date);

                      ({ filters: actualFiltersForThisDate } = actualPagesForThisDate[index]);
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
          }
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

    context('when a service has a multipage document', async () => {
      describe('Service with a multipage document', async () => {
        await validateServiceWithHistory('service_with_multipage_document', expectedServices.service_with_multipage_document);
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
