import Service from '../../src/archivist/services/service.js';
import SourceDocument from '../../src/archivist/services/sourceDocument.js';
import Terms from '../../src/archivist/services/terms.js';

const service = new Service({
  id: 'service_with_history',
  name: 'Service with history',
});

const filters = [
  function removeShareButton() {
    return 'last-removeShareButton';
  },
  function removePrintButton() {
    return 'last-removePrintButton';
  },
];

[
  new Terms({
    service,
    type: 'Terms of Service',
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-history.example/terms',
        contentSelectors: 'main',
        insignificantContentSelectors: undefined,
        filters,
      }),
    ],
    validUntil: null,
  }),
  new Terms({
    service,
    type: 'Terms of Service',
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-history.example/tos',
        contentSelectors: 'body',
        insignificantContentSelectors: undefined,
        filters: undefined,
      }),
    ],
    validUntil: '2020-07-22T11:30:21.000Z',
  }),
  new Terms({
    service,
    type: 'Terms of Service',
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-history.example/tos',
        contentSelectors: 'body',
        insignificantContentSelectors: undefined,
        filters: undefined,
      }),
    ],
    validUntil: '2020-08-15T21:30:21.000Z',
  }),
  new Terms({
    service,
    type: 'Terms of Service',
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-history.example/tos',
        contentSelectors: 'main',
        insignificantContentSelectors: undefined,
        filters: [
          function removeShareButton() {
            return 'first-removeShareButton';
          },
        ],
      }),
    ],
    validUntil: '2020-08-22T11:30:21.000Z',
  }),
  new Terms({
    service,
    type: 'Terms of Service',
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-history.example/tos',
        contentSelectors: 'main',
        insignificantContentSelectors: undefined,
        filters: [
          function removeShareButton() {
            return 'second-removeShareButton';
          },
        ],
      }),
    ],
    validUntil: '2020-09-15T21:30:21.000Z',
  }),
  new Terms({
    service,
    type: 'Terms of Service',
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-history.example/terms_of_service',
        contentSelectors: 'body',
        insignificantContentSelectors: undefined,
        filters: [
          function removeShareButton() {
            return 'second-removeShareButton';
          },
          function removePrintButton() {
            return 'second-removePrintButton';
          },
        ],
      }),
    ],
    validUntil: '2020-09-29T21:30:21.000Z',
  }),
  new Terms({
    service,
    type: 'Terms of Service',
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-history.example/terms',
        contentSelectors: 'main',
        insignificantContentSelectors: undefined,
        filters: [
          function removeShareButton() {
            return 'second-removeShareButton';
          },
          function removePrintButton() {
            return 'third-removePrintButton';
          },
        ],
      }),
    ],
    validUntil: '2020-09-30T21:30:21.000Z',
  }),
  new Terms({
    service,
    type: 'Terms of Service',
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-history.example/terms',
        contentSelectors: 'main',
        insignificantContentSelectors: undefined,
        filters: [
          function removeShareButton() {
            return 'third-removeShareButton';
          },
          function removePrintButton() {
            return 'third-removePrintButton';
          },
        ],
      }),
    ],
    validUntil: '2020-10-20T12:30:21.000Z',
  }),
  new Terms({
    service,
    type: 'Terms of Service',
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-history.example/terms',
        contentSelectors: 'main',
        insignificantContentSelectors: undefined,
        filters: [
          function removeShareButton() {
            return 'third-removeShareButton';
          },
          function removePrintButton() {
            return 'last-removePrintButton';
          },
        ],
      }),
    ],
    validUntil: '2020-11-01T12:30:21.000Z',
  }),
  new Terms({
    service,
    type: 'Privacy Policy',
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-history.example/privacy',
        contentSelectors: 'body',
        insignificantContentSelectors: undefined,
        filters: undefined,
      }),
    ],
    validUntil: null,
  }),
].forEach(declaration => service.addTerms(declaration));

export default service;
