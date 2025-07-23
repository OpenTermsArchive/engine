import fs from 'fs/promises';
import path from 'path';

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import expectedServices from '../../../test/fixtures/services.js';
import * as exposedFilters from '../extract/exposedFilters.js';

import Service from './service.js';
import SourceDocument from './sourceDocument.js';
import Terms from './terms.js';

import { getDeclaredServicesIds, loadServiceDeclaration, loadServiceFilters, getServiceFilters, createSourceDocuments, createServiceFromDeclaration, load, loadWithHistory } from './index.js';

chai.use(sinonChai);
const { expect } = chai;

describe('Services', () => {
  describe('#getDeclaredServicesIds', () => {
    let readdir;

    beforeEach(() => {
      readdir = sinon.stub(fs, 'readdir');
    });

    afterEach(() => {
      sinon.restore();
    });

    context('with valid JSON service declarations', () => {
      beforeEach(() => {
        readdir.resolves([
          'serviceA.json',
          'serviceB.json',
          'serviceC.json',
        ]);
      });

      it('returns service IDs from JSON files', async () => {
        const serviceIds = await getDeclaredServicesIds();

        expect(serviceIds).to.deep.equal([ 'serviceA', 'serviceB', 'serviceC' ]);
      });
    });

    context('with mixed file types', () => {
      beforeEach(() => {
        readdir.resolves([
          'serviceA.json',
          'serviceB.txt',
          'serviceC.js',
          'serviceD.json',
          'readme.md',
        ]);
      });

      it('filters out non-JSON files', async () => {
        const serviceIds = await getDeclaredServicesIds();

        expect(serviceIds).to.deep.equal([ 'serviceA', 'serviceD' ]);
      });
    });

    context('with history files', () => {
      beforeEach(() => {
        readdir.resolves([
          'serviceA.json',
          'serviceA.history.json',
          'serviceB.json',
          'serviceB.history.json',
          'serviceC.json',
        ]);
      });

      it('excludes history files', async () => {
        const serviceIds = await getDeclaredServicesIds();

        expect(serviceIds).to.deep.equal([ 'serviceA', 'serviceB', 'serviceC' ]);
      });
    });

    context('with complex filenames', () => {
      beforeEach(() => {
        readdir.resolves([
          'service-with-dashes.json',
          'Service With Spaces.json',
          'service·A.json',
          'Service B!.json',
          'service_with_underscores.json',
          'service.with.dots.json',
        ]);
      });

      it('handles complex service ID patterns', async () => {
        const serviceIds = await getDeclaredServicesIds();

        expect(serviceIds).to.deep.equal([
          'service-with-dashes',
          'Service With Spaces',
          'service·A',
          'Service B!',
          'service_with_underscores',
          'service.with.dots',
        ]);
      });
    });

    context('with empty directory', () => {
      beforeEach(() => {
        readdir.resolves([]);
      });

      it('returns empty array', async () => {
        const serviceIds = await getDeclaredServicesIds();

        expect(serviceIds).to.deep.equal([]);
      });
    });

    context('when directory read fails', () => {
      beforeEach(() => {
        readdir.rejects(new Error('ENOENT: no such file or directory'));
      });

      it('throws the original error', async () => {
        await expect(getDeclaredServicesIds()).to.be.rejectedWith('ENOENT: no such file or directory');
      });
    });

    context('with JSON files containing "history" but not as suffix', () => {
      beforeEach(() => {
        readdir.resolves([
          'history-service.json',
          'service-history.json',
          'service.history.json',
          'normal-service.json',
        ]);
      });

      it('excludes only files with .history.json suffix', async () => {
        const serviceIds = await getDeclaredServicesIds();

        expect(serviceIds).to.deep.equal([
          'history-service',
          'service-history',
          'normal-service',
        ]);
      });
    });
  });

  describe('#loadServiceDeclaration', () => {
    let readFile;

    beforeEach(() => {
      readFile = sinon.stub(fs, 'readFile');
    });

    afterEach(() => {
      sinon.restore();
    });

    context('with valid JSON service declaration', () => {
      const serviceId = 'serviceA';
      const validDeclaration = {
        name: 'Service A',
        terms: {
          'Terms of Service': {
            fetch: 'https://example.com/tos',
            select: 'body',
          },
        },
      };

      beforeEach(() => {
        readFile.resolves(JSON.stringify(validDeclaration));
      });

      it('returns parsed service declaration', async () => {
        const result = await loadServiceDeclaration(serviceId);

        expect(result).to.deep.equal(validDeclaration);
      });

      it('reads from correct file path', async () => {
        await loadServiceDeclaration(serviceId);

        expect(readFile).to.have.been.calledWith(sinon.match(filePath => filePath.endsWith(`${path.sep}serviceA.json`)));
      });
    });

    context('when file contains invalid JSON', () => {
      const serviceId = 'invalidJson';

      beforeEach(() => {
        readFile.resolves('{ invalid json content');
      });

      it('throws descriptive error message', async () => {
        try {
          await loadServiceDeclaration(serviceId);
          expect.fail('Expected function to throw an error');
        } catch (error) {
          expect(error.message).to.include('The "invalidJson" service declaration is malformed and cannot be parsed');
          expect(error.message).to.include('invalidJson.json');
        }
      });
    });
  });

  describe('#loadServiceFilters', () => {
    let access;

    beforeEach(() => {
      access = sinon.stub(fs, 'access');
    });

    afterEach(() => {
      sinon.restore();
    });

    context('when service filters file does not exist', () => {
      const serviceId = 'serviceWithoutFilters';

      beforeEach(() => {
        const error = new Error('ENOENT: no such file or directory');

        error.code = 'ENOENT';
        access.rejects(error);
      });

      it('returns empty object', async () => {
        const result = await loadServiceFilters(serviceId);

        expect(result).to.deep.equal({});
      });

      it('checks for file existence', async () => {
        await loadServiceFilters(serviceId);

        expect(access).to.have.been.calledWith(sinon.match(filePath => filePath.endsWith(`${path.sep}serviceWithoutFilters.filters.js`)));
      });
    });

    context('with real service that has filters file', () => {
      let result;

      before(async () => {
        result = await loadServiceFilters('service_with_filters_history');
      });

      it('has expected filters functions', () => {
        expect(result.removePrintButton).to.be.a('function');
        expect(result.removeShareButton).to.be.a('function');
        expect(result.removePrintButton.name).to.equal('removePrintButton');
        expect(result.removeShareButton.name).to.equal('removeShareButton');
      });
    });
  });

  describe('#getServiceFilters', () => {
    it('returns undefined if filterNames is falsy', () => {
      const result = getServiceFilters({}, undefined);

      expect(result).to.be.undefined;
    });

    it('returns filters from exposedFilters by string name', () => {
      const filterNames = Object.keys(exposedFilters);

      const filterName = filterNames[0];
      const result = getServiceFilters({}, [filterName]);

      expect(result).to.deep.equal([exposedFilters[filterName]]);
    });

    it('returns filters from serviceFilters by string name', () => {
      const serviceFilters = { custom: () => 'custom' };
      const result = getServiceFilters(serviceFilters, ['custom']);

      expect(result).to.deep.equal([serviceFilters.custom]);
    });

    it('returns undefined for unknown filter names', () => {
      const result = getServiceFilters({}, ['notFound']);

      expect(result).to.be.undefined;
    });

    it('wraps object-based filter config and preserves function name', () => {
      const paramFilter = (dom, param) => param;
      const serviceFilters = { paramFilter };
      const result = getServiceFilters(serviceFilters, [{ paramFilter: 'foo' }]);

      expect(result[0]).to.be.a('function');
      expect(result[0].name).to.equal('paramFilter');
      expect(result[0](null, 'context')).to.equal('foo');
    });

    context('parameters passed to filters', () => {
      let serviceLoadedFilters;
      let passedDOM;
      let passedContext;

      before(() => {
        serviceLoadedFilters = { testParamsFilter: (dom, params, context) => ({ dom, params, context }) };
        passedDOM = '<div>test</div>';
        passedContext = { location: 'https://example.com' };
      });

      const testParameterPassing = params => {
        const serviceDeclaredFilters = [{ testParamsFilter: params }];
        const [loadedFilter] = getServiceFilters(serviceLoadedFilters, serviceDeclaredFilters);
        const filterResult = loadedFilter(passedDOM, passedContext);

        expect(filterResult.params).to.deep.equal(params);
        expect(filterResult.dom).to.equal(passedDOM);
        expect(filterResult.context).to.equal(passedContext);
      };

      context('as a string', () => {
        it('passes parameters correctly', () => {
          testParameterPassing('param');
        });
      });

      context('as an array', () => {
        it('passes parameters correctly', () => {
          testParameterPassing([ 'param1', 'param2' ]);
        });
      });

      context('as an object', () => {
        it('passes parameters correctly', () => {
          testParameterPassing({ param1: 'param1', param2: 'param2' });
        });
      });
    });
  });

  describe('#createSourceDocuments', () => {
    const realFilterNames = Object.keys(exposedFilters);
    let result;
    const serviceId = 'service_with_filters_history';

    context('when terms declaration has only one source document', () => {
      const termsDeclaration = {
        fetch: 'https://example.com/terms',
        executeClientScripts: true,
        select: 'body',
        remove: '.ads',
        filter: [
          realFilterNames[0],
          'removePrintButton',
        ],
      };

      before(async () => {
        result = await createSourceDocuments(serviceId, termsDeclaration);
      });

      it('creates a single SourceDocument', () => {
        expect(result).to.have.length(1);
        expect(result[0]).to.be.instanceOf(SourceDocument);
      });

      it('resolves both exposed and custom filters', () => {
        const sourceDocument = result[0];

        expect(sourceDocument.filters).to.be.an('array');
        expect(sourceDocument.filters).to.have.length(2);
        expect(sourceDocument.filters[0]).to.be.a('function');
        expect(sourceDocument.filters[0]).to.equal(exposedFilters[realFilterNames[0]]);
        expect(sourceDocument.filters[1]).to.be.a('function');
        expect(sourceDocument.filters[1].name).to.equal('removePrintButton');
      });

      it('creates a SourceDocument with the correct properties', () => {
        const sourceDocument = result[0];

        expect(sourceDocument.location).to.equal(termsDeclaration.fetch);
        expect(sourceDocument.executeClientScripts).to.equal(termsDeclaration.executeClientScripts);
        expect(sourceDocument.contentSelectors).to.equal(termsDeclaration.select);
        expect(sourceDocument.insignificantContentSelectors).to.equal(termsDeclaration.remove);
      });
    });

    context('when terms declaration has multiple source documents', () => {
      const termsDeclaration = {
        fetch: 'https://example.com/base',
        executeClientScripts: false,
        select: 'body',
        remove: '.base-ads',
        filter: [
          realFilterNames[0],
          'removePrintButton',
        ],
        combine: [
          {
            fetch: 'https://example.com/doc1',
            select: '.content',
            filter: ['removeShareButton'],
          },
          {
            executeClientScripts: true,
            remove: '.doc2-ads',
          },
        ],
      };

      before(async () => {
        result = await createSourceDocuments(serviceId, termsDeclaration);
      });

      it('creates multiple SourceDocuments', () => {
        expect(result).to.have.length(2);
        expect(result[0]).to.be.instanceOf(SourceDocument);
        expect(result[1]).to.be.instanceOf(SourceDocument);
      });

      it('resolves both exposed and custom filters', () => {
        const firstSourceDocument = result[0];
        const secondSourceDocument = result[1];

        expect(firstSourceDocument.filters).to.be.an('array');
        expect(firstSourceDocument.filters).to.have.length(1);
        expect(firstSourceDocument.filters[0]).to.be.a('function');
        expect(firstSourceDocument.filters[0].name).to.equal('removeShareButton');

        expect(secondSourceDocument.filters).to.be.an('array');
        expect(secondSourceDocument.filters).to.have.length(2);
        expect(secondSourceDocument.filters[0]).to.be.a('function');
        expect(secondSourceDocument.filters[0].name).to.equal('removeQueryParams');
        expect(secondSourceDocument.filters[1]).to.be.a('function');
        expect(secondSourceDocument.filters[1].name).to.equal('removePrintButton');
      });

      it('combines base properties and source document specific properties correctly', () => {
        const firstSourceDocument = result[0];

        expect(firstSourceDocument.location).to.equal('https://example.com/doc1');
        expect(firstSourceDocument.contentSelectors).to.equal('.content');
        expect(firstSourceDocument.executeClientScripts).to.equal(false);
        expect(firstSourceDocument.insignificantContentSelectors).to.equal('.base-ads');

        const secondSourceDocument = result[1];

        expect(secondSourceDocument.location).to.equal(termsDeclaration.fetch);
        expect(secondSourceDocument.contentSelectors).to.equal(termsDeclaration.select);
        expect(secondSourceDocument.executeClientScripts).to.equal(true);
        expect(secondSourceDocument.insignificantContentSelectors).to.equal('.doc2-ads');
      });
    });
  });

  describe('#createServiceFromDeclaration', () => {
    const serviceId = 'service·A';
    let result;

    before(async () => {
      result = await createServiceFromDeclaration(serviceId);
    });

    it('creates a Service instance', () => {
      expect(result).to.be.instanceOf(Service);
    });

    it('sets correct service id', () => {
      expect(result.id).to.equal(serviceId);
    });

    it('sets correct service name', () => {
      expect(result.name).to.equal('Service·A');
    });

    it('adds Terms for the declared terms type', () => {
      const terms = result.getTerms({ type: 'Terms of Service' });

      expect(terms).to.be.instanceOf(Terms);
      expect(terms.type).to.equal('Terms of Service');
    });

    it('creates Terms with correct source documents', () => {
      const terms = result.getTerms({ type: 'Terms of Service' });

      expect(terms.sourceDocuments).to.be.an('array');
      expect(terms.sourceDocuments).to.have.length(1);
      expect(terms.sourceDocuments[0]).to.be.instanceOf(SourceDocument);
      expect(terms.sourceDocuments[0]).to.deep.equal({
        location: 'https://www.servicea.example/tos',
        executeClientScripts: undefined,
        contentSelectors: 'body',
        insignificantContentSelectors: undefined,
        filters: undefined,
        content: undefined,
        mimeType: undefined,
        id: 'tos',
      });
    });
  });

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
      result = await load();
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
        result = await load([ 'service·A', 'Service B!' ]);
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
      result = await loadWithHistory();
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
        result = await loadWithHistory([ 'service·A', 'Service B!' ]);
      });

      it('loads only the given services', () => {
        expect(result).to.have.all.keys('service·A', 'Service B!');
      });
    });
  });
});
