import DocumentDeclaration from '../../src/archivist/services/documentDeclaration.js';
import PageDeclaration from '../../src/archivist/services/pageDeclaration.js';
import Service from '../../src/archivist/services/service.js';

const service = new Service({
  id: 'service_B',
  name: 'Service B',
});

service.addDocumentDeclaration(new DocumentDeclaration({
  service,
  termsType: 'Privacy Policy',
  pages: [new PageDeclaration({
    location: 'https://www.serviceb.example/privacy',
    contentSelectors: 'body',
    noiseSelectors: undefined,
    filters: undefined,
  })],
  validUntil: null,
}));

export default service;
