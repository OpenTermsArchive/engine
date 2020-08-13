import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const TYPES = require('../../src/types.json');

const AVAILABLE_TYPES_NAME = Object.keys(TYPES);

const documentsProperties = () => {
  const result = {};
  AVAILABLE_TYPES_NAME.forEach(type => {
    result[type] = { $ref: '#/definitions/document' };
  });
  return result;
};

const schema = {
  type: 'object',
  additionalProperties: false,
  title: 'Service declaration',
  required: [
    'name',
    'documents'
  ],
  properties: {
    name: {
      type: 'string',
      title: 'Service public name',
      examples: [
        'Facebook'
      ]
    },
    documents: {
      type: 'object',
      properties: documentsProperties(),
      propertyNames: {
        enum: AVAILABLE_TYPES_NAME,
      }
    },
    importedFrom: {
      type: 'string',
      title: 'Imported from',
      examples: [
        'https://github.com/tosdr/tosback2/blob/5acac7abb5e967cfafd124a5e275f98f6ecd423e/rules/4shared.com.xml'
      ]
    }
  },
  definitions: {
    document: {
      type: 'object',
      additionalProperties: false,
      required: [
        'fetch',
        'select'
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
          ]
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
