import Service from '../../src/app/services/service.js';
import Document from '../../src/app/services/document.js';
import { FUTUR_DATE } from '../../src/app/services/index.js';

const service = new Service({
  id: 'service_B',
  name: 'Service B',
});

const latest = new Document({
  service,
  type: 'Privacy Policy',
  location: 'https://www.serviceb.example/privacy',
  contentSelectors: 'body',
  noiseSelectors: undefined,
  filters: undefined,
  validUntil: null
});

service.documents = {
  'Privacy Policy': {
    latest,
    history: [
      new Document({
        ...latest,
        validUntil: FUTUR_DATE
      })
    ]
  }
};

export default service;
