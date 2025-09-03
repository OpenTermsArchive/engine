import Service from '../../src/archivist/services/service.js';
import SourceDocument from '../../src/archivist/services/sourceDocument.js';
import Terms from '../../src/archivist/services/terms.js';

const service = new Service({
  id: 'service_with_filters_history',
  name: 'Service with filters history',
});

const filters = [
  function removeShareButton() {
    return 'last-removeShareButton';
  },
  function removePrintButton() {
    return 'last-removePrintButton';
  },
  function removeButtonWithText(text) {
    return `last-removeButtonWithText-${text}`;
  },
];

[
  new Terms({
    service,
    type: 'Terms of Service',
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-filters-history.example/terms',
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
        location: 'https://www.service-with-filters-history.example/terms',
        contentSelectors: 'main',
        insignificantContentSelectors: undefined,
        filters: [
          function removeShareButton() {
            return 'first-removeShareButton';
          },
          function removePrintButton() {
            return 'first-removePrintButton';
          },
          function removeButtonWithText(text) {
            return `first-removeButtonWithText-${text}`;
          },
        ],
      }),
    ],
    validUntil: '2020-07-22T11:30:21.000Z',
  }),
  new Terms({
    service,
    type: 'Terms of Service',
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-filters-history.example/terms',
        contentSelectors: 'main',
        insignificantContentSelectors: undefined,
        filters: [
          function removeShareButton() {
            return 'first-removeShareButton';
          },
          function removePrintButton() {
            return 'second-removePrintButton';
          },
          function removeButtonWithText(text) {
            return `second-removeButtonWithText-${text}`;
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
        location: 'https://www.service-with-filters-history.example/terms',
        contentSelectors: 'main',
        insignificantContentSelectors: undefined,
        filters: [
          function removeShareButton() {
            return 'second-removeShareButton';
          },
          function removePrintButton() {
            return 'second-removePrintButton';
          },
          function removeButtonWithText(text) {
            return `second-removeButtonWithText-${text}`;
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
        location: 'https://www.service-with-filters-history.example/terms',
        contentSelectors: 'main',
        insignificantContentSelectors: undefined,
        filters: [
          function removeShareButton() {
            return 'second-removeShareButton';
          },
          function removePrintButton() {
            return 'third-removePrintButton';
          },
          function removeButtonWithText(text) {
            return `third-removeButtonWithText-${text}`;
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
        location: 'https://www.service-with-filters-history.example/terms',
        contentSelectors: 'main',
        insignificantContentSelectors: undefined,
        filters: [
          function removeShareButton() {
            return 'third-removeShareButton';
          },
          function removePrintButton() {
            return 'third-removePrintButton';
          },
          function removeButtonWithText(text) {
            return `third-removeButtonWithText-${text}`;
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
        location: 'https://www.service-with-filters-history.example/terms',
        contentSelectors: 'main',
        insignificantContentSelectors: undefined,
        filters: [
          function removeShareButton() {
            return 'third-removeShareButton';
          },
          function removePrintButton() {
            return 'last-removePrintButton';
          },
          function removeButtonWithText(text) {
            return `last-removeButtonWithText-${text}`;
          },
        ],
      }),
    ],
    validUntil: '2020-11-01T12:30:21.000Z',
  }),
].forEach(declaration => service.addTerms(declaration));

export default service;
