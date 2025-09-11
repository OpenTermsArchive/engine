const definitions = {
  location: {
    type: 'string',
    format: 'uri',
    description: 'The URL where the document can be found',
  },
  pdfLocation: {
    type: 'string',
    pattern: '^https?://.+.[pP][dD][fF](\\?.+)?$',
    description: 'The URL where the document can be found',
  },
  executeClientScripts: {
    type: 'boolean',
    description: 'Execute client-side JavaScript loaded by the document before accessing the content, in case the DOM modifications are needed to access the content.',
  },
  selectors: {
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
  contentSelectors: { $ref: '#/definitions/selectors' },
  insignificantContentSelectors: { $ref: '#/definitions/selectors' },
  filters: {
    type: 'array',
    items: {
      oneOf: [
        {
          type: 'string',
          pattern: '^.+$',
          description: 'Filter function name',
        },
        {
          type: 'object',
          description: 'Filter function with parameters. The key is the filter function name, the value is the parameters.',
          additionalProperties: false,
          minProperties: 1,
          maxProperties: 1,
        },
      ],
    },
  },
  validUntil: {
    type: 'string',
    format: 'date-time',
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
};

export default definitions;
