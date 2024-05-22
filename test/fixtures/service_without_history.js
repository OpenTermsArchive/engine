import Service from '../../src/archivist/services/service.js';
import SourceDocument from '../../src/archivist/services/sourceDocument.js';
import Terms from '../../src/archivist/services/terms.js';

const service = new Service({
  id: 'service_without_history',
  name: 'Service without history',
});

const filters = [
  function removeShareButton() {
    return 'last-removeShareButton';
  },
  function removePrintButton() {
    return 'last-removePrintButton';
  },
];

service.addTerms(new Terms({
  service,
  type: 'Terms of Service',
  sourceDocuments: [new SourceDocument({
    location: 'https://www.service-without-history.example/tos',
    contentSelectors: 'body',
    insignificantContentSelectors: undefined,
    filters,
  })],
  validUntil: null,
}));

export default service;
