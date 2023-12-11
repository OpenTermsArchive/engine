import { expect } from 'chai';

import { toISODateWithoutMilliseconds } from './date.js';

describe('toISODateWithoutMilliseconds', () => {
  const EXPECTED_RESULT = '2023-12-06T12:34:56Z';
  const INPUTS = {
    'valid ISO 8601 date string': '2023-12-06T12:34:56.789Z',
    'parsable date string not in ISO 8601 format': 'Wed, 06 Dec 2023 12:34:56 GMT',
    'a valid ISO 8601 date string without milliseconds': '2023-12-06T12:34:56Z',
  };

  Object.entries(INPUTS).forEach(([ description, input ]) => {
    context(`with ${description}`, () => {
      it('returns the given date in ISO 8601 format without milliseconds', () => {
        expect(toISODateWithoutMilliseconds(input)).to.equal(EXPECTED_RESULT);
      });
    });
  });

  context('with an invalid date string', () => {
    it('throws an error', () => {
      const inputDate = 'invalidDateString';

      expect(() => toISODateWithoutMilliseconds(inputDate)).to.throw(Error);
    });
  });
});
