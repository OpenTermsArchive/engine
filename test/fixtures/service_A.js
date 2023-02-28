import Service from '../../src/archivist/services/service.js';
import SourceDocument from '../../src/archivist/services/sourceDocument.js';
import Terms from '../../src/archivist/services/terms.js';

const service = new Service({
  id: 'service_A',
  name: 'Service A',
});

service.addTerms(new Terms({
  service,
  termsType: 'Terms of Service',
  validUntil: null,
  sourceDocuments: [new SourceDocument({
    location: 'https://www.servicea.example/tos',
    contentSelectors: 'body',
    insignificantContentSelectors: undefined,
    filters: undefined,
  })],
}));

export default service;
