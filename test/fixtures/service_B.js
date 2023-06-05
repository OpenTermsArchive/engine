import Service from '../../src/archivist/services/service.js';
import SourceDocument from '../../src/archivist/services/sourceDocument.js';
import Terms from '../../src/archivist/services/terms.js';

const service = new Service({
  id: 'Service B!', // ensure unusual but valid names are tested throughout the stack
  name: 'Service B!',
});

service.addTerms(new Terms({
  service,
  type: 'Privacy Policy',
  sourceDocuments: [new SourceDocument({
    location: 'https://www.serviceb.example/privacy',
    contentSelectors: 'body',
    insignificantContentSelectors: undefined,
    filters: undefined,
  })],
  validUntil: null,
}));

export default service;
