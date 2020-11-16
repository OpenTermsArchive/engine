import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

import chai from 'chai';
import chaiExclude from 'chai-exclude';

import * as services from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
chai.use(chaiExclude);
const { expect } = chai;

describe('Services', () => {
  describe('#load', () => {
    let result;
    let expectedServices;

    before(async () => {
      result = await services.load();
      const expectedServicesModule = await import(pathToFileURL(path.resolve(__dirname, '../../../test/fixtures/services.js'))); // eslint-disable-line no-await-in-loop
      expectedServices = expectedServicesModule.default;
    });

    it('loads "Service A"', async () => {
      await validateServiceWithoutHistory(result.service_A, expectedServices.service_A);
    });
    it('loads "Service B"', async () => {
      await validateServiceWithoutHistory(result.service_B, expectedServices.service_B);
    });
    context('when a service has no history', async () => {
      it('loads the service', async () => {
        await validateServiceWithoutHistory(result.service_without_history, expectedServices.service_without_history);
      });
    });
    context('when a service has only delcarations history', async () => {
      it('loads the service', async () => {
        await validateServiceWithoutHistory(result.service_with_declaration_history, expectedServices.service_with_declaration_history);
      });
    });
    context('when a service has only filters history', async () => {
      it('loads the service', async () => {
        await validateServiceWithoutHistory(result.service_with_filters_history, expectedServices.service_with_filters_history);
      });
    });
    context('when a service has both filters and delcarations histories', async () => {
      it('loads the service', async () => {
        await validateServiceWithoutHistory(result.service_with_history, expectedServices.service_with_history);
      });
    });
  });

  describe('#loadWithHistory', () => {
    let result;
    let expectedServices;

    before(async () => {
      result = await services.loadWithHistory();
      const expectedServicesModule = await import(pathToFileURL(path.resolve(__dirname, '../../../test/fixtures/services.js'))); // eslint-disable-line no-await-in-loop
      expectedServices = expectedServicesModule.default;
    });

    it('loads "Service A"', async () => {
      await validateServiceWithHistory(result.service_A, expectedServices.service_A);
    });
    it('loads "Service B"', async () => {
      await validateServiceWithHistory(result.service_B, expectedServices.service_B);
    });
    context('when a service has no history', async () => {
      it('loads the service with its history', async () => {
        await validateServiceWithHistory(result.service_without_history, expectedServices.service_without_history);
      });
    });
    context('when a service has only delcarations history', async () => {
      it('loads the service with its history', async () => {
        await validateServiceWithHistory(result.service_with_declaration_history, expectedServices.service_with_declaration_history);
      });
    });
    context('when a service has only filters history', async () => {
      it('loads the service with its history', async () => {
        await validateServiceWithHistory(result.service_with_filters_history, expectedServices.service_with_filters_history);
      });
    });
    context('when a service has both filters and delcarations histories', async () => {
      it('loads the service with its history', async () => {
        await validateServiceWithHistory(result.service_with_history, expectedServices.service_with_history);
      });
    });
  });
});

async function validateServiceWithoutHistory(actual, expected) {
  expect(actual).excludingEvery([ 'filters', '_history' ]).to.deep.equal(expected);

  for (const documentType of actual.getDocumentTypes()) {
    const { _history: actualHistory } = actual.getDocument(documentType);
    expect(actualHistory).to.be.undefined;

    const { filters: actualFilters } = actual.getDocument(documentType);
    const { filters: expectedFilters } = expected.getDocument(documentType);

    if (expectedFilters) {
      for (let indexFilter = 0; indexFilter < actualFilters.length; indexFilter++) {
        expect(await actualFilters[indexFilter]()).equal(await expectedFilters[indexFilter]()); // eslint-disable-line no-await-in-loop
      }
    } else {
      expect(actualFilters).to.be.undefined;
    }
  }
}

async function validateServiceWithHistory(actual, expected) {
  expect(actual).excludingEvery('filters').to.deep.equal(expected);

  for (const documentType of actual.getDocumentTypes()) {
    const { _history: expectedHistory } = expected._documents[documentType];
    const expectedHistoryDates = expectedHistory && expectedHistory.map(entry => entry.validUntil);

    if (expectedHistoryDates) {
      for (const date of expectedHistoryDates) {
        const expectedDocument = expected.getDocument(documentType, date);
        const actualDocument = actual.getDocument(documentType, date);

        if (expectedDocument.filters) {
          expect(actualDocument.filters.length).to.equal(expectedDocument.filters.length);

          for (let indexFilter = 0; indexFilter < expectedDocument.filters.length; indexFilter++) {
            expect(await actualDocument.filters[indexFilter]()).equal(await expectedDocument.filters[indexFilter]()); // eslint-disable-line no-await-in-loop
          }
        } else {
          expect(actualDocument.filters).to.be.undefined;
        }
      }
    }
  }
}
