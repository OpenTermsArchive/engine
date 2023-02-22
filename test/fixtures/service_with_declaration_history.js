import Service from '../../src/archivist/services/service.js';
import SourceDocument from '../../src/archivist/services/sourceDocument.js';
import Terms from '../../src/archivist/services/terms.js';

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
  new Terms({
    service,
    termsType: 'Terms of Service',
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-declaration-history.example/terms',
        contentSelectors: 'main',
        noiseSelectors: undefined,
        filters,
      }),
    ],
    validUntil: null,
  }),
  new Terms({
    service,
    termsType: 'Terms of Service',
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-declaration-history.example/tos',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
    ],
    validUntil: '2020-08-22T21:30:21.000Z',
  }),
  new Terms({
    service,
    termsType: 'Terms of Service',
    sourceDocuments: [
      new SourceDocument({
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
].forEach(declaration => service.addTerms(declaration));

export default service;
