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

