import DocumentDeclaration from '../../src/archivist/services/documentDeclaration.js';
import PageDeclaration from '../../src/archivist/services/pageDeclaration.js';
import Service from '../../src/archivist/services/service.js';

const service = new Service({
  id: 'service_with_multipage_document',
  name: 'Service with multipage',
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
  new DocumentDeclaration({
    service,
    termsType: 'Community Guidelines',
    validUntil: null,
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-multipage-document.example/community-standards',
        contentSelectors: '#main',
        noiseSelectors: 'body',
        filters: undefined,
        executeClientScripts: true,
      }),
      new PageDeclaration({
        location: 'https://www.service-with-multipage-document.example/community-standards/hate-speech/',
        contentSelectors: 'body',
        noiseSelectors: '#footer',
        filters: undefined,
        executeClientScripts: false,
      }),
      new PageDeclaration({
        location: 'https://www.service-with-multipage-document.example/community-standards/violence-incitement/',
        contentSelectors: 'body',
        noiseSelectors: 'body',
        filters,
        executeClientScripts: true,
      }),
    ],
  }),
  new DocumentDeclaration({
    service,
    termsType: 'Community Guidelines',
    validUntil: '2020-04-15T21:30:21.000Z',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-multipage-document.example/community-standards',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
      new PageDeclaration({
        location: 'https://www.service-with-multipage-document.example/community-standards/hate-speech/',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
      new PageDeclaration({
        location: 'https://www.service-with-multipage-document.example/community-standards/violence-incitement/',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: [filters[0]],
      }),
    ],
  }),
  new DocumentDeclaration({
    service,
    termsType: 'Community Guidelines',
    validUntil: '2020-03-15T21:30:21.000Z',
    pages: [
      new PageDeclaration({
        location: 'https://www.service-with-multipage-document.example/community-standards',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
      new PageDeclaration({
        location: 'https://www.service-with-multipage-document.example/community-standards/hate-speech/',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
      new PageDeclaration({
        location: 'https://www.service-with-multipage-document.example/community-standards/violence-incitement/',
        contentSelectors: 'body',
        noiseSelectors: undefined,
        filters: undefined,
      }),
    ],
  }),
].forEach(declaration => service.addDocumentDeclaration(declaration));

export default service;
