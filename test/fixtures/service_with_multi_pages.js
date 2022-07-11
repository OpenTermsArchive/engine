import DocumentDeclaration from '../../src/archivist/services/documentDeclaration.js';
import PageDeclaration from '../../src/archivist/services/pageDeclaration.js';
import Service from '../../src/archivist/services/service.js';

const service = new Service({
  id: 'service_with_multi_pages',
  name: 'Service with multi pages',
});

const filters = [
  async function removeSharesButton() {
    return 'last-removeSharesButton';
  },
  async function removePrintButton() {
    return 'last-removePrintButton';
  },
];

const documentsDeclarations = [
  new DocumentDeclaration({
    service,
    type: 'Community Guidelines',
    validUntil: null,
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-multi-pages.example/community-standards',
        contentSelectors: '#main',
        noiseSelectors: undefined,
        filters: undefined,
      }),
      new PageDeclaration({
        location: 'https://www.service-with-multi-pages.example/community-standards/hate-speech/',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
      new PageDeclaration({
        location: 'https://www.service-with-multi-pages.example/community-standards/violence-incitement/',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters,
      }),
    ],
  }),
  new DocumentDeclaration({
    service,
    type: 'Community Guidelines',
    validUntil: '2020-04-15T21:30:21.000Z',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-multi-pages.example/community-standards',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
      new PageDeclaration({
        location: 'https://www.service-with-multi-pages.example/community-standards/hate-speech/',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
      new PageDeclaration({
        location: 'https://www.service-with-multi-pages.example/community-standards/violence-incitement/',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: [filters[0]],
      }),
    ],
  }),
  new DocumentDeclaration({
    service,
    type: 'Community Guidelines',
    validUntil: '2020-03-15T21:30:21.000Z',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-multi-pages.example/community-standards',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
      new PageDeclaration({
        location: 'https://www.service-with-multi-pages.example/community-standards/hate-speech/',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
      new PageDeclaration({
        location: 'https://www.service-with-multi-pages.example/community-standards/violence-incitement/',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
    ],
  }),
];

for (const document of documentsDeclarations) {
  service.addDocumentDeclaration(document);
}

export default service;
