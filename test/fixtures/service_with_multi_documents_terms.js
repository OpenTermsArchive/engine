import Document from '../../src/archivist/services/document.js';
import Service from '../../src/archivist/services/service.js';
import Terms from '../../src/archivist/services/terms.js';

const service = new Service({
  id: 'service_with_multi_documents_terms',
  name: 'Service with multi documents terms',
});

const filters = [
  async function removeShareButton() {
    return 'last-removeShareButton';
  },
  async function removePrintButton() {
    return 'last-removePrintButton';
  },
];

[
  new Terms({
    service,
    termsType: 'Community Guidelines',
    validUntil: null,
    documents: [
      new Document({
        location: 'https://www.service-with-multi-documents-terms.example/community-standards',
        contentSelectors: '#main',
        noiseSelectors: 'body',
        filters: undefined,
        executeClientScripts: true,
      }),
      new Document({
        location: 'https://www.service-with-multi-documents-terms.example/community-standards/hate-speech/',
        contentSelectors: 'body',
        noiseSelectors: '#footer',
        filters: undefined,
        executeClientScripts: false,
      }),
      new Document({
        location: 'https://www.service-with-multi-documents-terms.example/community-standards/violence-incitement/',
        contentSelectors: 'body',
        noiseSelectors: 'body',
        filters,
        executeClientScripts: true,
      }),
    ],
  }),
  new Terms({
    service,
    termsType: 'Community Guidelines',
    validUntil: '2020-04-15T21:30:21.000Z',
    documents: [
      new Document({
        location: 'https://www.service-with-multi-documents-terms.example/community-standards',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
      new Document({
        location: 'https://www.service-with-multi-documents-terms.example/community-standards/hate-speech/',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
      new Document({
        location: 'https://www.service-with-multi-documents-terms.example/community-standards/violence-incitement/',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: [filters[0]],
      }),
    ],
  }),
  new Terms({
    service,
    termsType: 'Community Guidelines',
    validUntil: '2020-03-15T21:30:21.000Z',
    documents: [
      new Document({
        location: 'https://www.service-with-multi-documents-terms.example/community-standards',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
      new Document({
        location: 'https://www.service-with-multi-documents-terms.example/community-standards/hate-speech/',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
      new Document({
        location: 'https://www.service-with-multi-documents-terms.example/community-standards/violence-incitement/',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
    ],
  }),
].forEach(declaration => service.addTerms(declaration));

export default service;
