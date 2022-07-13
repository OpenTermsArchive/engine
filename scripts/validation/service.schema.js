import { DOCUMENT_TYPES } from '../../src/archivist/services/index.js';

const AVAILABLE_TYPES_NAME = Object.keys(DOCUMENT_TYPES);

const documentsProperties = () => {
  const result = {};

  AVAILABLE_TYPES_NAME.forEach(type => {
    result[type] = {
      oneOf: [
        { $ref: '#/definitions/singlePageDocument' },
        { $ref: '#/definitions/multiPageDocument' },
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
  required: [ 'name', 'documents' ],
  properties: {
    name: {
      type: 'string',
      title: 'Service public name',
      examples: ['Facebook'],
    },
    documents: {
      type: 'object',
      properties: documentsProperties(),
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
    pdfDocument: {
      type: 'object',
      additionalProperties: false,
      required: ['fetch'],
      properties: {
        fetch: {
          type: 'string',
          pattern: '^https?://.+.[pP][dD][fF](\\?.+)?$',
          description: 'The URL where the document can be found',
        },
      },
    },
    page: {
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
    singlePageDocument: {
      allOf: [
        { $ref: '#/definitions/page' },
        { required: [ 'fetch', 'select' ] },
      ],
    },
    multiPageDocument: {
      type: 'object',
      additionalProperties: false,
      required: ['combine'],
      properties: {
        combine: {
          type: 'array',
          items: { $ref: '#/definitions/page' },
        },
        select: { $ref: '#/definitions/contentSelectors' },
        filter: { $ref: '#/definitions/filters' },
        remove: { $ref: '#/definitions/noiseSelectors' },
        executeClientScripts: { $ref: '#/definitions/executeClientScripts' },
      },
    },
    location: {
      type: 'string',
      format: 'uri',
      description: 'The URL where the document can be found',
    },
    executeClientScripts: {
      type: 'boolean',
      description: 'Execute client-side JavaScript loaded by the document before accessing the content, in case the DOM modifications are needed to access the content.',
    },
    contentSelectors: {
      description: 'Selector(s) that targets element to include',
      oneOf: [
        { $ref: '#/definitions/cssSelector' },
        { $ref: '#/definitions/range' },
        {
          type: 'array',
          items: { oneOf: [{ $ref: '#/definitions/cssSelector' }, { $ref: '#/definitions/range' }] },
        },
      ],
    },
    noiseSelectors: {
      description: 'Selector(s) that targets element to exclude',
      oneOf: [
        { $ref: '#/definitions/cssSelector' },
        { $ref: '#/definitions/range' },
        {
          type: 'array',
          items: { oneOf: [{ $ref: '#/definitions/cssSelector' }, { $ref: '#/definitions/range' }] },
        },
      ],
    },
    filters: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^.+$',
        description: 'Filter function name',
      },
    },
    cssSelector: {
      type: 'string',
      pattern: '^.+$',
      description: 'A CSS selector',
    },
    range: {
      type: 'object',
      properties: {
        startBefore: { $ref: '#/definitions/cssSelector' },
        startAfter: { $ref: '#/definitions/cssSelector' },
        endBefore: { $ref: '#/definitions/cssSelector' },
        endAfter: { $ref: '#/definitions/cssSelector' },
      },
      oneOf: [
        { required: [ 'startBefore', 'endBefore' ] },
        { required: [ 'startBefore', 'endAfter' ] },
        { required: [ 'startAfter', 'endBefore' ] },
        { required: [ 'startAfter', 'endAfter' ] },
      ],
    },
  },
};

export default schema;
