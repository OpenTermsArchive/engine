import DocumentDeclaration from '../../src/archivist/services/documentDeclaration.js';
import PageDeclaration from '../../src/archivist/services/pageDeclaration.js';
import Service from '../../src/archivist/services/service.js';

const service = new Service({
  id: 'service_with_history',
  name: 'Service with history',
});

const filters = [
  async function removeSharesButton() {
    return 'last-removeSharesButton';
  },
  async function removePrintButton() {
    return 'last-removePrintButton';
  },
];

[
  new DocumentDeclaration({
    service,
    type: 'Terms of Service',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-history.example/terms',
        contentSelectors: 'main',
        noiseSelectors: undefined,
        filters,
      }),
    ],
    validUntil: null,
  }),
  new DocumentDeclaration({
    service,
    type: 'Terms of Service',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-history.example/tos',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
    ],
    validUntil: '2020-07-22T11:30:21.000Z',
  }),
  new DocumentDeclaration({
    service,
    type: 'Terms of Service',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-history.example/tos',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
    ],
    validUntil: '2020-08-15T21:30:21.000Z',
  }),
  new DocumentDeclaration({
    service,
    type: 'Terms of Service',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-history.example/tos',
        contentSelectors: 'main',
        noiseSelectors: undefined,
        filters: [
          async function removeSharesButton() {
            return 'first-removeSharesButton';
          },
        ],
      }),
    ],
    validUntil: '2020-08-22T11:30:21.000Z',
  }),
  new DocumentDeclaration({
    service,
    type: 'Terms of Service',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-history.example/tos',
        contentSelectors: 'main',
        noiseSelectors: undefined,
        filters: [
          async function removeSharesButton() {
            return 'second-removeSharesButton';
          },
        ],
      }),
    ],
    validUntil: '2020-09-15T21:30:21.000Z',
  }),
  new DocumentDeclaration({
    service,
    type: 'Terms of Service',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-history.example/terms_of_service',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: [
          async function removeSharesButton() {
            return 'second-removeSharesButton';
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
    type: 'Terms of Service',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-history.example/terms',
        contentSelectors: 'main',
        noiseSelectors: undefined,
        filters: [
          async function removeSharesButton() {
            return 'second-removeSharesButton';
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
    type: 'Terms of Service',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-history.example/terms',
        contentSelectors: 'main',
        noiseSelectors: undefined,
        filters: [
          async function removeSharesButton() {
            return 'third-removeSharesButton';
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
    type: 'Terms of Service',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-history.example/terms',
        contentSelectors: 'main',
        noiseSelectors: undefined,
        filters: [
          async function removeSharesButton() {
            return 'third-removeSharesButton';
          },
          async function removePrintButton() {
            return 'last-removePrintButton';
          },
        ],
      }),
    ],
    validUntil: '2020-11-01T12:30:21.000Z',
  }),
  new DocumentDeclaration({
    service,
    type: 'Privacy Policy',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-history.example/privacy',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
    ],
    validUntil: null,
  }),
].forEach(declaration => service.addDocumentDeclaration(declaration));

export default service;
