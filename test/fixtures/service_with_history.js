import Service from '../../src/app/services/service.js';
import Document from '../../src/app/services/document.js';
import { FUTUR_DATE } from '../../src/app/services/index.js';

const service = new Service({
  id: 'service_with_history',
  name: 'Service with history',
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
  location: 'https://www.service-with-history.example/terms',
  contentSelectors: 'main',
  noiseSelectors: undefined,
  filters,
  validUntil: null
});

const history = [
  new Document({
    service,
    type: 'Terms of Service',
    location: 'https://www.service-with-history.example/tos',
    contentSelectors: 'body',
    noiseSelectors: undefined,
    filters: undefined,
    validUntil: '2020-07-22T11:30:21.000Z'
  }),
  new Document({
    service,
    type: 'Terms of Service',
    location: 'https://www.service-with-history.example/tos',
    contentSelectors: 'body',
    noiseSelectors: undefined,
    filters: undefined,
    validUntil: '2020-08-15T21:30:21.000Z'
  }),
  new Document({
    service,
    type: 'Terms of Service',
    location: 'https://www.service-with-history.example/tos',
    contentSelectors: 'main',
    noiseSelectors: undefined,
    filters: [
      async function removeSharesButton() {
        return 'first-removeSharesButton';
      }
    ],
    validUntil: '2020-08-22T11:30:21.000Z'
  }),
  new Document({
    service,
    type: 'Terms of Service',
    location: 'https://www.service-with-history.example/tos',
    contentSelectors: 'main',
    noiseSelectors: undefined,
    filters: [
      async function removeSharesButton() {
        return 'second-removeSharesButton';
      }
    ],
    validUntil: '2020-09-15T21:30:21.000Z'
  }),
  new Document({
    service,
    type: 'Terms of Service',
    location: 'https://www.service-with-history.example/terms_of_service',
    contentSelectors: 'body',
    noiseSelectors: undefined,
    filters: [
      async function removeSharesButton() {
        return 'second-removeSharesButton';
      },
      async function removePrintButton() {
        return 'second-removePrintButton';
      }
    ],
    validUntil: '2020-09-29T21:30:21.000Z'
  }),
  new Document({
    service,
    type: 'Terms of Service',
    location: 'https://www.service-with-history.example/terms',
    contentSelectors: 'main',
    noiseSelectors: undefined,
    filters: [
      async function removeSharesButton() {
        return 'second-removeSharesButton';
      },
      async function removePrintButton() {
        return 'third-removePrintButton';
      }
    ],
    validUntil: '2020-09-30T21:30:21.000Z'
  }),
  new Document({
    service,
    type: 'Terms of Service',
    location: 'https://www.service-with-history.example/terms',
    contentSelectors: 'main',
    noiseSelectors: undefined,
    filters: [
      async function removeSharesButton() {
        return 'third-removeSharesButton';
      },
      async function removePrintButton() {
        return 'third-removePrintButton';
      }
    ],
    validUntil: '2020-10-20T12:30:21.000Z'
  }),
  new Document({
    service,
    type: 'Terms of Service',
    location: 'https://www.service-with-history.example/terms',
    contentSelectors: 'main',
    noiseSelectors: undefined,
    filters: [
      async function removeSharesButton() {
        return 'third-removeSharesButton';
      },
      async function removePrintButton() {
        return 'last-removePrintButton';
      }
    ],
    validUntil: '2020-11-01T12:30:21.000Z'
  }),
  new Document({
    service,
    type: 'Terms of Service',
    location: 'https://www.service-with-history.example/terms',
    contentSelectors: 'main',
    noiseSelectors: undefined,
    filters: [
      async function removeSharesButton() {
        return 'last-removeSharesButton';
      },
      async function removePrintButton() {
        return 'last-removePrintButton';
      }
    ],
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
