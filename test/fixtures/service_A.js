import DocumentDeclaration from '../../src/archivist/services/documentDeclaration.js';
import PageDeclaration from '../../src/archivist/services/pageDeclaration.js';
import Service from '../../src/archivist/services/service.js';

const service = new Service({
  id: 'service_A',
  name: 'Service A',
});

const document = new DocumentDeclaration({
  service,
  type: 'Terms of Service',
  validUntil: null,
  pages: [new PageDeclaration({
    location: 'https://www.servicea.example/tos',
    contentSelectors: 'body',
    noiseSelectors: undefined,
    filters: undefined,
  })],
});

service.addDocumentDeclaration(document);

export default service;
