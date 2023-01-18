import DocumentDeclaration from '../../src/archivist/services/documentDeclaration.js';
import PageDeclaration from '../../src/archivist/services/pageDeclaration.js';
import Service from '../../src/archivist/services/service.js';

const service = new Service({
  id: 'service_with_declaration_history',
  name: 'Service with declaration history',
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
        location: 'https://www.service-with-declaration-history.example/terms',
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
        location: 'https://www.service-with-declaration-history.example/tos',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
    ],
    validUntil: '2020-08-22T21:30:21.000Z',
  }),
  new DocumentDeclaration({
    service,
    termsType: 'Terms of Service',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-declaration-history.example/tos',
        contentSelectors: 'main',
        noiseSelectors: undefined,
        filters: [
          async function removeShareButton() {
            return 'last-removeShareButton';
          },
        ],
      }),
    ],
    validUntil: '2020-09-30T21:30:21.000Z',
  }),
].forEach(declaration => service.addDocumentDeclaration(declaration));

export default service;
