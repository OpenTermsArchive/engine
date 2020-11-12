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
      it('properly loads the service', async () => {
        await validateServiceWithoutHistory(result.service_without_history, expectedServices.service_without_history);
      });
    });
    context('when a service has only delcarations history', async () => {
      it('properly loads the service', async () => {
        await validateServiceWithoutHistory(result.service_with_declaration_history, expectedServices.service_with_declaration_history);
      });
    });
    context('when a service has only filters history', async () => {
      it('properly loads the service', async () => {
        await validateServiceWithoutHistory(result.service_with_filters_history, expectedServices.service_with_filters_history);
      });
    });
    context('when a service has both filters and delcarations histories', async () => {
      it('properly loads the service', async () => {
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
      it('properly loads the service with its history', async () => {
        await validateServiceWithHistory(result.service_without_history, expectedServices.service_without_history);
      });
    });
    context('when a service has only delcarations history', async () => {
      it('properly loads the service with its history', async () => {
        await validateServiceWithHistory(result.service_with_declaration_history, expectedServices.service_with_declaration_history);
      });
    });
    context('when a service has only filters history', async () => {
      it('properly loads the service with its history', async () => {
        await validateServiceWithHistory(result.service_with_filters_history, expectedServices.service_with_filters_history);
      });
    });
    context('when a service has both filters and delcarations histories', async () => {
      it('properly loads the service with its history', async () => {
        await validateServiceWithHistory(result.service_with_history, expectedServices.service_with_history);
      });
    });
  });
});

async function validateServiceWithoutHistory(actual, expected) {
  for (const documentType of Object.keys(actual.documents)) {
    const { history: actualHistory } = actual.documents[documentType].latest;
    expect(actualHistory).to.be.undefined;

    const { filters: actualFilters } = actual.documents[documentType].latest;
    const { filters: expectedFilters } = expected.documents[documentType].latest;

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

  for (const documentType of Object.keys(actual.documents)) {
    const { history: actualHistory } = actual.documents[documentType];
    const { history: expectedHistory } = expected.documents[documentType];

    for (let indexHistory = 0; indexHistory < actualHistory.length; indexHistory++) {
      if (expectedHistory[indexHistory].filters) {
        for (let indexFilter = 0; indexFilter < actualHistory[indexHistory].filters.length; indexFilter++) {
          expect(await actualHistory[indexHistory].filters[indexFilter]()).equal(await expectedHistory[indexHistory].filters[indexFilter]()); // eslint-disable-line no-await-in-loop
        }
      } else {
        expect(actualHistory[indexHistory].filters).to.be.undefined;
      }
    }
  }
}
