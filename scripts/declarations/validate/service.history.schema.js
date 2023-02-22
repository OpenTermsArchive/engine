import TERMS_TYPES from '@opentermsarchive/terms-types';

import definitions from './definitions.js';

const AVAILABLE_TYPES_NAME = Object.keys(TERMS_TYPES);

const termsProperties = () => {
  const result = {};

  AVAILABLE_TYPES_NAME.forEach(type => {
    result[type] = {
      type: 'array',
      items: {
        oneOf: [
          { $ref: '#/definitions/singleSourceDocumentsTermsHistory' },
          { $ref: '#/definitions/multiSourceDocumentsTermsHistory' },
          { $ref: '#/definitions/pdfDocumentHistory' },
        ],
      },
    };
  });

  return result;
};

const schema = {
  type: 'object',
  additionalProperties: false,
  title: 'Service declaration history',
  properties: termsProperties(),
  propertyNames: { enum: AVAILABLE_TYPES_NAME },
  definitions: {
    ...definitions,
    pdfDocumentHistory: {
      type: 'object',
      additionalProperties: false,
      required: [ 'fetch', 'validUntil' ],
      properties: {
        fetch: { $ref: '#/definitions/pdfLocation' },
        validUntil: { $ref: '#/definitions/validUntil' },
      },
    },
    singleSourceDocumentsTermsHistory: {
      type: 'object',
      additionalProperties: false,
      required: [ 'fetch', 'select', 'validUntil' ],
      properties: {
        fetch: { $ref: '#/definitions/location' },
        select: { $ref: '#/definitions/contentSelectors' },
        filter: { $ref: '#/definitions/filters' },
        remove: { $ref: '#/definitions/noiseSelectors' },
        executeClientScripts: { $ref: '#/definitions/executeClientScripts' },
        validUntil: { $ref: '#/definitions/validUntil' },
      },
    },
    multiSourceDocumentsTermsHistory: {
      type: 'object',
      additionalProperties: false,
      required: ['combine'],
      properties: {
        combine: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['fetch'],
            properties: {
              fetch: { $ref: '#/definitions/location' },
              select: { $ref: '#/definitions/contentSelectors' },
              filter: { $ref: '#/definitions/filters' },
              remove: { $ref: '#/definitions/noiseSelectors' },
              executeClientScripts: { $ref: '#/definitions/executeClientScripts' },
            },
          },
        },
        select: { $ref: '#/definitions/contentSelectors' },
        filter: { $ref: '#/definitions/filters' },
        remove: { $ref: '#/definitions/noiseSelectors' },
        executeClientScripts: { $ref: '#/definitions/executeClientScripts' },
        validUntil: { $ref: '#/definitions/validUntil' },
      },
    },
  },
};

export default schema;
