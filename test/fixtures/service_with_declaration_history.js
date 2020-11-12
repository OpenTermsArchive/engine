import Service from '../../src/app/services/service.js';
import Document from '../../src/app/services/document.js';
import { FUTUR_DATE } from '../../src/app/services/index.js';

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

const latest = new Document({
  service,
  type: 'Terms of Service',
  location: 'https://www.service-with-declaration-history.example/terms',
  contentSelectors: 'main',
  noiseSelectors: undefined,
  filters,
  validUntil: null
});

const history = [
  new Document({
    service,
    type: 'Terms of Service',
    location: 'https://www.service-with-declaration-history.example/tos',
    contentSelectors: 'body',
    noiseSelectors: undefined,
    filters: undefined,
    validUntil: '2020-08-22T21:30:21.000Z'
  }),
  new Document({
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
  new Document({
    service,
    type: 'Terms of Service',
    location: 'https://www.service-with-declaration-history.example/terms',
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

service.documents = {
  'Terms of Service': {
    latest,
    history,
  }
};

export default service;
