import Service from '../../src/archivist/services/service.js';
import SourceDocument from '../../src/archivist/services/sourceDocument.js';
import Terms from '../../src/archivist/services/terms.js';

const service = new Service({
  id: 'service_with_declaration_history',
  name: 'Service with declaration history',
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
        location: 'https://www.service-with-declaration-history.example/terms',
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
        location: 'https://www.service-with-declaration-history.example/tos',
        contentSelectors: 'body',
        insignificantContentSelectors: undefined,
        filters: undefined,
      }),
    ],
    validUntil: '2020-08-22T21:30:21.000Z',
  }),
  new Terms({
    service,
    type: 'Terms of Service',
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-declaration-history.example/tos',
        contentSelectors: 'main',
        insignificantContentSelectors: undefined,
        filters: [
          function removeShareButton() {
            return 'last-removeShareButton';
          },
        ],
      }),
    ],
    validUntil: '2020-09-30T21:30:21.000Z',
  }),
].forEach(declaration => service.addTerms(declaration));

export default service;
