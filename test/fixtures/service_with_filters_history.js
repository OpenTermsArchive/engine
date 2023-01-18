import DocumentDeclaration from '../../src/archivist/services/documentDeclaration.js';
import PageDeclaration from '../../src/archivist/services/pageDeclaration.js';
import Service from '../../src/archivist/services/service.js';

const service = new Service({
  id: 'service_with_filters_history',
  name: 'Service with filters history',
});

const filters = [
  async function removeShareButton() {
    return 'last-removeShareButton';
  },
  async function removePrintButton() {
    return 'last-removePrintButton';
  },
];

[
  new DocumentDeclaration({
    service,
    termsType: 'Terms of Service',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-filters-history.example/terms',
        contentSelectors: 'main',
        noiseSelectors: undefined,
        filters,
      }),
    ],
    validUntil: null,
  }),
  new DocumentDeclaration({
    service,
    termsType: 'Terms of Service',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-filters-history.example/terms',
        contentSelectors: 'main',
        noiseSelectors: undefined,
        filters: [
          async function removeShareButton() {
            return 'first-removeShareButton';
          },
          async function removePrintButton() {
            return 'first-removePrintButton';
          },
        ],
      }),
    ],
    validUntil: '2020-07-22T11:30:21.000Z',
  }),
  new DocumentDeclaration({
    service,
    termsType: 'Terms of Service',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-filters-history.example/terms',
        contentSelectors: 'main',
        noiseSelectors: undefined,
        filters: [
          async function removeShareButton() {
            return 'first-removeShareButton';
          },
          async function removePrintButton() {
            return 'second-removePrintButton';
          },
        ],
      }),
    ],
    validUntil: '2020-08-22T11:30:21.000Z',
  }),
  new DocumentDeclaration({
    service,
    termsType: 'Terms of Service',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-filters-history.example/terms',
        contentSelectors: 'main',
        noiseSelectors: undefined,
        filters: [
          async function removeShareButton() {
            return 'second-removeShareButton';
          },
          async function removePrintButton() {
            return 'second-removePrintButton';
          },
        ],
      }),
    ],
    validUntil: '2020-09-29T21:30:21.000Z',
  }),
  new DocumentDeclaration({
    service,
    termsType: 'Terms of Service',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-filters-history.example/terms',
        contentSelectors: 'main',
        noiseSelectors: undefined,
        filters: [
          async function removeShareButton() {
            return 'second-removeShareButton';
          },
          async function removePrintButton() {
            return 'third-removePrintButton';
          },
        ],
      }),
    ],
    validUntil: '2020-09-30T21:30:21.000Z',
  }),
  new DocumentDeclaration({
    service,
    termsType: 'Terms of Service',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-filters-history.example/terms',
        contentSelectors: 'main',
        noiseSelectors: undefined,
        filters: [
          async function removeShareButton() {
            return 'third-removeShareButton';
          },
          async function removePrintButton() {
            return 'third-removePrintButton';
          },
        ],
      }),
    ],
    validUntil: '2020-10-20T12:30:21.000Z',
  }),
  new DocumentDeclaration({
    service,
    termsType: 'Terms of Service',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-filters-history.example/terms',
        contentSelectors: 'main',
        noiseSelectors: undefined,
        filters: [
          async function removeShareButton() {
            return 'third-removeShareButton';
          },
          async function removePrintButton() {
            return 'last-removePrintButton';
          },
        ],
      }),
    ],
    validUntil: '2020-11-01T12:30:21.000Z',
  }),
].forEach(declaration => service.addDocumentDeclaration(declaration));

export default service;
