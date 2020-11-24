import Service from '../../src/app/services/service.js';
import DocumentDeclaration from '../../src/app/services/documentDeclaration.js';

const service = new Service({
  id: 'service_without_history',
  name: 'Service wihout history',
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
  location: 'https://www.service-wihout-history.example/tos',
  contentSelectors: 'body',
  noiseSelectors: undefined,
  filters,
  validUntil: null
});

service._documents = {
  'Terms of Service': {
    _latest: latest,
  }
};

export default service;
