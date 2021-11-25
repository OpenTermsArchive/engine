import DocumentDeclaration from '../../src/archivist/services/documentDeclaration.js';
import Service from '../../src/archivist/services/service.js';

const service = new Service({
  id: 'service_B',
  name: 'Service B',
});

const latest = new DocumentDeclaration({
  service,
  type: 'Privacy Policy',
  location: 'https://www.serviceb.example/privacy',
  contentSelectors: 'body',
  noiseSelectors: undefined,
  filters: undefined,
  validUntil: null,
});

service._documents = { 'Privacy Policy': { _latest: latest } };

export default service;
