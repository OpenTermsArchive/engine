import TERMS_TYPES from '@opentermsarchive/terms-types';

import definitions from './definitions.js';

const AVAILABLE_TYPES_NAME = Object.keys(TERMS_TYPES);

const termsProperties = () => {
  const result = {};

  AVAILABLE_TYPES_NAME.forEach(type => {
    result[type] = {
      oneOf: [
        { $ref: '#/definitions/singleSourceDocumentTerms' },
        { $ref: '#/definitions/multipleSourceDocumentsTerms' },
        { $ref: '#/definitions/pdfDocument' },
      ],
    };
  });

  return result;
};

const schema = {
  type: 'object',
  additionalProperties: false,
  title: 'Service declaration',
  required: [ 'name', 'terms' ],
  properties: {
    name: {
      type: 'string',
      title: 'Service public name',
      examples: ['Facebook'],
    },
    terms: {
      type: 'object',
      properties: termsProperties(),
      propertyNames: { enum: AVAILABLE_TYPES_NAME },
    },
    importedFrom: {
      type: 'string',
      title: 'Imported from',
      examples: [
        'https://github.com/tosdr/tosback2/blob/5acac7abb5e967cfafd124a5e275f98f6ecd423e/rules/4shared.com.xml',
      ],
    },
  },
  definitions: {
    ...definitions,
    pdfDocument: {
      type: 'object',
      additionalProperties: false,
      required: ['fetch'],
      properties: { fetch: { $ref: '#/definitions/pdfLocation' } },
    },
    sourceDocument: {
      type: 'object',
      additionalProperties: false,
      required: ['fetch'],
      properties: {
        fetch: { $ref: '#/definitions/location' },
        select: { $ref: '#/definitions/contentSelectors' },
        filter: { $ref: '#/definitions/filters' },
        remove: { $ref: '#/definitions/insignificantContentSelectors' },
        executeClientScripts: { $ref: '#/definitions/executeClientScripts' },
      },
    },
    singleSourceDocumentTerms: {
      allOf: [
        { $ref: '#/definitions/sourceDocument' },
        {
          type: 'object',
          required: [ 'fetch', 'select' ],
        },
      ],
    },
    multipleSourceDocumentsTerms: {
      type: 'object',
      additionalProperties: false,
      required: ['combine'],
      properties: {
        combine: {
          type: 'array',
          items: { $ref: '#/definitions/sourceDocument' },
        },
        select: { $ref: '#/definitions/contentSelectors' },
        filter: { $ref: '#/definitions/filters' },
        remove: { $ref: '#/definitions/insignificantContentSelectors' },
        executeClientScripts: { $ref: '#/definitions/executeClientScripts' },
      },
    },
  },
};

export default schema;
