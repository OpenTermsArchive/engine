import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const TYPES = require('../../src/app/types.json');

const AVAILABLE_TYPES_NAME = Object.keys(TYPES);

const documentsProperties = () => {
  const result = {};
  AVAILABLE_TYPES_NAME.forEach(type => {
    result[type] = {
      type: 'array',
      items: {
        oneOf: [
          { $ref: '#/definitions/document' },
          { $ref: '#/definitions/pdfDocument' },
        ]
      }
    };
  });
  return result;
};

const schema = {
  type: 'object',
  additionalProperties: false,
  title: 'Service declaration history',
  properties: documentsProperties(),
  propertyNames: {
    enum: AVAILABLE_TYPES_NAME,
  },
  definitions: {
    pdfDocument: {
      type: 'object',
      additionalProperties: false,
      required: [
        'fetch',
      ],
      properties: {
        fetch: {
          type: 'string',
          pattern: '^https?://.+\.[pP][dD][fF](\\?.+)?$',
          description: 'The URL where the document can be found'
        },
        validUntil: {
          type: 'string',
          format: 'date-time',
        },
      },
    },
    document: {
      type: 'object',
      additionalProperties: false,
      required: [
        'fetch',
        'select',
      ],
      properties: {
        fetch: {
          type: 'string',
          format: 'uri',
          description: 'The URL where the document can be found'
        },
        select: {
          description: 'Selector(s) that targets element to include',
          oneOf: [
            { $ref: '#/definitions/cssSelector' },
            { $ref: '#/definitions/range' },
            {
              type: 'array',
              items: {
                oneOf: [
                  { $ref: '#/definitions/cssSelector' },
                  { $ref: '#/definitions/range' },
                ]
              }
            }
          ]
        },
        filter: {
          type: 'array',
          items: {
            type: 'string',
            pattern: '^.+$',
            description: 'Filter function name'
          }
        },
        remove: {
          description: 'Selector(s) that targets element to exclude',
          oneOf: [
            { $ref: '#/definitions/cssSelector' },
            { $ref: '#/definitions/range' },
            {
              type: 'array',
              items: {
                oneOf: [
                  { $ref: '#/definitions/cssSelector' },
                  { $ref: '#/definitions/range' },
                ]
              }
            }
          ],
        },
        validUntil: {
          type: 'string',
          format: 'date-time',
        },
        executeClientScripts: {
          type: 'boolean',
          description: 'Execute client-side JavaScript loaded by the document before accessing the content, in case the DOM modifications are needed to access the content.',
        }
      }
    },
    cssSelector: {
      type: 'string',
      pattern: '^.+$',
      description: 'A CSS selector'
    },
    range: {
      type: 'object',
      properties: {
        startBefore: { $ref: '#/definitions/cssSelector' },
        startAfter: { $ref: '#/definitions/cssSelector' },
        endBefore: { $ref: '#/definitions/cssSelector' },
        endAfter: { $ref: '#/definitions/cssSelector' }
      },
      oneOf: [
        { required: [ 'startBefore', 'endBefore' ] },
        { required: [ 'startBefore', 'endAfter' ] },
        { required: [ 'startAfter', 'endBefore' ] },
        { required: [ 'startAfter', 'endAfter' ] },
      ]
    }
  }
};

export default schema;
