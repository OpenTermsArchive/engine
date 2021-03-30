import DocumentDeclaration from '../../src/app/services/documentDeclaration.js';
import Service from '../../src/app/services/service.js';

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
  validUntil: null,
});

service._documents = {
  'Terms of Service': {
    _latest: latest,
  },
};

export default service;
