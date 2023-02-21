import Document from '../../src/archivist/services/document.js';
import Service from '../../src/archivist/services/service.js';
import Terms from '../../src/archivist/services/terms.js';

const service = new Service({
  id: 'service_A',
  name: 'Service A',
});

service.addTerms(new Terms({
  service,
  termsType: 'Terms of Service',
  validUntil: null,
  documents: [new Document({
    location: 'https://www.servicea.example/tos',
    contentSelectors: 'body',
    noiseSelectors: undefined,
    filters: undefined,
  })],
}));

export default service;
