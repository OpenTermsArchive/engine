import Service from '../../src/app/services/service.js';
import DocumentDeclaration from '../../src/app/services/documentDeclaration.js';
import { FUTUR_DATE } from '../../src/app/services/index.js';

const service = new Service({
  id: 'service_B',
  name: 'Service B',
});

const latest = new DocumentDeclaration({
  service,
  type: 'Privacy Policy',
  location: 'https://www.serviceb.example/privacy',
  contentSelectors: 'body',
  noiseSelectors: undefined,
  filters: undefined,
  validUntil: null
});

service._documents = {
  'Privacy Policy': {
    _latest: latest,
    _history: [
      new DocumentDeclaration({
        ...latest,
        validUntil: FUTUR_DATE
      })
    ]
  }
};

export default service;
