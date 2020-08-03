import { TYPES } from '../../src/types.js';

const AVAILABLE_TYPES_NAME = Object.keys(TYPES);

const documentsProperties = () => {
  const result = {};
  AVAILABLE_TYPES_NAME.forEach(type => result[type] = { $ref: '#/definitions/document' });
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
    }
  },
  definitions: {
    document: {
      type: 'object',
      additionalProperties: false,
      required: [
        'location',
        'contentSelector'
      ],
      properties: {
        location: {
          type: 'string',
          format: 'uri',
          description: 'The URL where the document can be found'
        },
        contentSelector: {
          type: [ 'string', 'object', 'array' ],
          description: 'The content selector that targets the meaningful part of the document, excluding elements such as headers, footers and navigation'
        },
        filters: {
          type: 'array'
        },
        removeElements: {
          type: [ 'string', 'object', 'array' ],
          description: 'The content selector that targets element to exclude'
        }
      }
    }
  }
};

export default schema;
