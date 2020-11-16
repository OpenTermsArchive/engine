import Service from '../../src/app/services/service.js';
import DocumentDeclaration from '../../src/app/services/documentDeclaration.js';

const service = new Service({
  id: 'service_with_declaration_history',
  name: 'Service with declaration history',
});

const filters = [
  async function removeSharesButton() {
    return 'last-removeSharesButton';
  },
  async function removePrintButton() {
    return 'last-removePrintButton';
  }
];

const latest = new DocumentDeclaration({
  service,
  type: 'Terms of Service',
  location: 'https://www.service-with-declaration-history.example/terms',
  contentSelectors: 'main',
  noiseSelectors: undefined,
  filters,
  validUntil: null
});

const history = [
  new DocumentDeclaration({
    service,
    type: 'Terms of Service',
    location: 'https://www.service-with-declaration-history.example/tos',
    contentSelectors: 'body',
    noiseSelectors: undefined,
    filters: undefined,
    validUntil: '2020-08-22T21:30:21.000Z'
  }),
  new DocumentDeclaration({
    service,
    type: 'Terms of Service',
    location: 'https://www.service-with-declaration-history.example/tos',
    contentSelectors: 'main',
    noiseSelectors: undefined,
    filters: [ async function removeSharesButton() {
      return 'last-removeSharesButton';
    } ],
    validUntil: '2020-09-30T21:30:21.000Z'
  }),
];

service._documents = {
  'Terms of Service': {
    _latest: latest,
    _history: history,
  }
};

export default service;
