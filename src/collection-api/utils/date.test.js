import { expect } from 'chai';

import { parseISODate } from './date.js';

describe('parseISODate', () => {
  const VALID_INPUTS = {
    'a date': { input: '2023-06-01', expected: '2023-06-01T00:00:00.000Z' },
    'a date on a leap day': { input: '2024-02-29', expected: '2024-02-29T00:00:00.000Z' },
    'a date and time in UTC': { input: '2023-06-01T12:00:00Z', expected: '2023-06-01T12:00:00.000Z' },
    'a date and time with milliseconds': { input: '2023-06-01T12:00:00.123Z', expected: '2023-06-01T12:00:00.123Z' },
    'a date and time with an offset': { input: '2023-06-01T12:00:00+02:00', expected: '2023-06-01T10:00:00.000Z' },
  };

  const INVALID_INPUTS = {
    'a version ID': '7d44151738979cef26f25dee10cd0bbe7c56621e',
    'a word': 'not-a-date',
    'a number': '0',
    'a date in another format': 'June 2023',
    'a month that does not exist': '2023-13-45',
    'a day that does not exist': '2023-02-31',
    'a leap day in a common year': '2023-02-29',
    'a year and month without day': '2023-06',
    'a date and time without timezone': '2023-06-01T12:00:00',
    'a date and time without seconds': '2023-06-01T12:00Z',
    'an offset without minutes': '2023-06-01T12:00:00+02',
    'a leap second': '2023-06-01T23:59:60Z',
  };

  Object.entries(VALID_INPUTS).forEach(([ description, { input, expected }]) => {
    context(`with ${description}`, () => {
      it('returns the matching date', () => {
        expect(parseISODate(input).toISOString()).to.equal(expected);
      });
    });
  });

  Object.entries(INVALID_INPUTS).forEach(([ description, input ]) => {
    context(`with ${description}`, () => {
      it('returns null', () => {
        expect(parseISODate(input)).to.equal(null);
      });
    });
  });
});
