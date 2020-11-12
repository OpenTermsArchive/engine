import Service from '../../src/app/services/service.js';
import DocumentDeclaration from '../../src/app/services/documentDeclaration.js';
import { FUTUR_DATE } from '../../src/app/services/index.js';

const service = new Service({
  id: 'service_A',
  name: 'Service A',
});

const latest = new DocumentDeclaration({
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
      new DocumentDeclaration({
        ...latest,
        validUntil: FUTUR_DATE
      })
    ]
  }
};

export default service;
