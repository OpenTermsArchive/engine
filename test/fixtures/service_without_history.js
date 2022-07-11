import DocumentDeclaration from '../../src/archivist/services/documentDeclaration.js';
import PageDeclaration from '../../src/archivist/services/pageDeclaration.js';
import Service from '../../src/archivist/services/service.js';

const service = new Service({
  id: 'service_without_history',
  name: 'Service without history',
});

const filters = [
  async function removeSharesButton() {
    return 'last-removeSharesButton';
  },
  async function removePrintButton() {
    return 'last-removePrintButton';
  },
];

const page = new PageDeclaration({
  location: 'https://www.service-without-history.example/tos',
  contentSelectors: 'body',
  noiseSelectors: undefined,
  filters,
});

const document = new DocumentDeclaration({
  service,
  type: 'Terms of Service',
  pages: [page],
  validUntil: null,
});

service.addDocumentDeclaration(document);

export default service;
