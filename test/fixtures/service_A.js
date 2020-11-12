import Service from '../../src/app/services/service.js';
import Document from '../../src/app/services/document.js';
import { FUTUR_DATE } from '../../src/app/services/index.js';

const service = new Service({
  id: 'service_A',
  name: 'Service A',
});

const latest = new Document({
  service,
  type: 'Terms of Service',
  location: 'https://www.servicea.example/tos',
  contentSelectors: 'body',
  noiseSelectors: undefined,
  filters: undefined,
  validUntil: null
});

service._documents = {
  'Terms of Service': {
    _latest: latest,
    _history: [
      new Document({
        ...latest,
        validUntil: FUTUR_DATE
      })
    ]
  }
};

export default service;
