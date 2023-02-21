import Document from '../../src/archivist/services/document.js';
import Service from '../../src/archivist/services/service.js';
import Terms from '../../src/archivist/services/terms.js';

const service = new Service({
  id: 'service_B',
  name: 'Service B',
});

service.addTerms(new Terms({
  service,
  termsType: 'Privacy Policy',
  documents: [new Document({
    location: 'https://www.serviceb.example/privacy',
    contentSelectors: 'body',
    noiseSelectors: undefined,
    filters: undefined,
  })],
  validUntil: null,
}));

export default service;
