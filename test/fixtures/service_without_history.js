import Service from '../../src/app/services/service.js';
import Document from '../../src/app/services/document.js';
import { FUTUR_DATE } from '../../src/app/services/index.js';

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

const latest = new Document({
  service,
  type: 'Terms of Service',
  location: 'https://www.service-wihout-history.example/tos',
  contentSelectors: 'body',
  noiseSelectors: undefined,
  filters,
  validUntil: null
});

const history = [
  new Document({
    service,
    type: 'Terms of Service',
    location: 'https://www.service-wihout-history.example/tos',
    contentSelectors: 'body',
    noiseSelectors: undefined,
    filters,
    validUntil: FUTUR_DATE
  })
];

service._documents = {
  'Terms of Service': {
    _latest: latest,
    _history: history,
  }
};

export default service;
