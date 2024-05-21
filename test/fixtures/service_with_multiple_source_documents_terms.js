import Service from '../../src/archivist/services/service.js';
import SourceDocument from '../../src/archivist/services/sourceDocument.js';
import Terms from '../../src/archivist/services/terms.js';

const service = new Service({
  id: 'service_with_multiple_source_documents_terms',
  name: 'Service with terms with multiple source documents',
});

const filters = [
  function removeShareButton() {
    return 'last-removeShareButton';
  },
  function removePrintButton() {
    return 'last-removePrintButton';
  },
];

[
  new Terms({
    service,
    type: 'Community Guidelines',
    validUntil: null,
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-multiple-source-documents-terms.example/community-standards',
        contentSelectors: '#main',
        insignificantContentSelectors: 'body',
        filters: undefined,
        executeClientScripts: true,
      }),
      new SourceDocument({
        location: 'https://www.service-with-multiple-source-documents-terms.example/community-standards/hate-speech/',
        contentSelectors: 'body',
        insignificantContentSelectors: '#footer',
        filters: undefined,
        executeClientScripts: false,
      }),
      new SourceDocument({
        location: 'https://www.service-with-multiple-source-documents-terms.example/community-standards/violence-incitement/',
        contentSelectors: 'body',
        insignificantContentSelectors: 'body',
        filters,
        executeClientScripts: true,
      }),
    ],
  }),
  new Terms({
    service,
    type: 'Community Guidelines',
    validUntil: '2020-04-15T21:30:21.000Z',
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-multiple-source-documents-terms.example/community-standards',
        contentSelectors: 'body',
        insignificantContentSelectors: undefined,
        filters: undefined,
      }),
      new SourceDocument({
        location: 'https://www.service-with-multiple-source-documents-terms.example/community-standards/hate-speech/',
        contentSelectors: 'body',
        insignificantContentSelectors: undefined,
        filters: undefined,
      }),
      new SourceDocument({
        location: 'https://www.service-with-multiple-source-documents-terms.example/community-standards/violence-incitement/',
        contentSelectors: 'body',
        insignificantContentSelectors: undefined,
        filters: [filters[0]],
      }),
    ],
  }),
  new Terms({
    service,
    type: 'Community Guidelines',
    validUntil: '2020-03-15T21:30:21.000Z',
    sourceDocuments: [
      new SourceDocument({
        location: 'https://www.service-with-multiple-source-documents-terms.example/community-standards',
        contentSelectors: 'body',
        insignificantContentSelectors: undefined,
        filters: undefined,
      }),
      new SourceDocument({
        location: 'https://www.service-with-multiple-source-documents-terms.example/community-standards/hate-speech/',
        contentSelectors: 'body',
        insignificantContentSelectors: undefined,
        filters: undefined,
      }),
      new SourceDocument({
        location: 'https://www.service-with-multiple-source-documents-terms.example/community-standards/violence-incitement/',
        contentSelectors: 'body',
        insignificantContentSelectors: undefined,
        filters: undefined,
      }),
    ],
  }),
].forEach(declaration => service.addTerms(declaration));

export default service;
