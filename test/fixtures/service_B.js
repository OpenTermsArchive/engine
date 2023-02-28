import Service from '../../src/archivist/services/service.js';
import SourceDocument from '../../src/archivist/services/sourceDocument.js';
import Terms from '../../src/archivist/services/terms.js';

const service = new Service({
  id: 'service_B',
  name: 'Service B',
});

service.addTerms(new Terms({
  service,
  termsType: 'Privacy Policy',
  sourceDocuments: [new SourceDocument({
    location: 'https://www.serviceb.example/privacy',
    contentSelectors: 'body',
    insignificantContentSelectors: undefined,
    filters: undefined,
  })],
  validUntil: null,
}));

export default service;
