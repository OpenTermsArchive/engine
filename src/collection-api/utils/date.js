import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv();

addFormats(ajv, [ 'date', 'date-time' ]);

const isISODate = ajv.compile({ type: 'string', oneOf: [{ format: 'date' }, { format: 'date-time' }] }); // `new Date()` alone cannot validate: it reads `0` as the year 2000, `2023-02-31` as March 3rd, and a time without timezone in the timezone of the server

export function parseISODate(value) {
  if (!isISODate(value)) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date; // The formats accept some values that `Date` cannot read, such as a leap second (`23:59:60Z`) or an offset without minutes (`+02`)
}
