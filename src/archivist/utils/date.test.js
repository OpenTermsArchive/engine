import { expect } from 'chai';

import { toISODateWithoutMilliseconds } from './date.js';

describe('toISODateWithoutMilliseconds', () => {
  context('with a valid ISO 8601 date string', () => {
    it('removes milliseconds', () => {
      const inputDate = '2023-12-06T12:34:56.789Z';
      const expectedResult = '2023-12-06T12:34:56Z';

      expect(toISODateWithoutMilliseconds(inputDate)).to.equal(expectedResult);
    });
  });

  context('with a parsable date string not in ISO 8601 format', () => {
    it('returns an ISO 8601 date string without milliseconds', () => {
      const inputDate = 'Wed, 06 Dec 2023 12:34:56 GMT';
      const expectedResult = '2023-12-06T12:34:56Z';

      expect(toISODateWithoutMilliseconds(inputDate)).to.equal(expectedResult);
    });
  });

  context('with a valid ISO 8601 date string without milliseconds', () => {
    it('returns the given date', () => {
      const inputDate = '2023-12-06T12:34:56Z';

      expect(toISODateWithoutMilliseconds(inputDate)).to.equal(inputDate);
    });
  });

  context('with an invalid date string', () => {
    it('throws an error', () => {
      const inputDate = 'invalidDateString';

      expect(() => toISODateWithoutMilliseconds(inputDate)).to.throw(Error);
    });
  });
});
