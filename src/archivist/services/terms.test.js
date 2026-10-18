import { expect } from 'chai';

import SourceDocument from './sourceDocument.js';
import Terms from './terms.js';

describe('Terms', () => {
  const service = { name: 'Service' };
  const termsType = 'Terms of Service';
  const URL = 'https://www.service.example/terms';
  const document1 = new SourceDocument({
    location: URL,
    contentSelectors: [
      {
        startBefore: '#startBefore',
        endBefore: '#endBefore',
      },
      'body',
    ],
    insignificantContentSelectors: [
      {
        startBefore: '#startBefore',
        endBefore: '#endBefore',
      },
      'body',
    ],
  });
  const document1AsJSON = {
    fetch: URL,
    select: [
      {
        startBefore: '#startBefore',
        endBefore: '#endBefore',
      },
      'body',
    ],
    remove: [
      {
        startBefore: '#startBefore',
        endBefore: '#endBefore',
      },
      'body',
    ],
    filter: undefined,
    executeClientScripts: undefined,
  };

  const document2 = new SourceDocument({
    location: URL,
    contentSelectors: 'body',
  });

  const document2AsJSON = {
    fetch: URL,
    select: 'body',
    remove: undefined,
    filter: undefined,
    executeClientScripts: undefined,
  };

  describe('#toPersistence', () => {
    it('converts terms with single source document to JSON representation', () => {
      const result = new Terms({ service, type: termsType, sourceDocuments: [document1] }).toPersistence();

      const expectedResult = {
        name: service.name,
        terms: { [termsType]: document1AsJSON },
      };

      expect(result).to.deep.equal(expectedResult);
    });

    it('converts terms with multiple source documents to JSON representation', () => {
      const result = new Terms({ service, type: termsType, sourceDocuments: [ document1, document2 ] }).toPersistence();

      const expectedResult = {
        name: service.name,
        terms: { [termsType]: { combine: [ document1AsJSON, document2AsJSON ] } },
      };

      expect(result).to.deep.equal(expectedResult);
    });
  });

  describe('#duplicateSourceDocuments', () => {
    it('returns the source documents that repeat a snapshot ID', () => {
      const terms = new Terms({ service, type: termsType, sourceDocuments: [ document1, document2 ] });

      expect(terms.duplicateSourceDocuments).to.deep.equal([document2]);
    });

    it('returns source documents that share a snapshot ID even when their locations differ', () => {
      const sourceDocuments = [
        new SourceDocument({ location: 'https://m.vk.ru/terms' }),
        new SourceDocument({ location: 'https://id.vk.ru/terms' }),
        new SourceDocument({ location: 'https://vk.ru/ads?country=ru' }),
        new SourceDocument({ location: 'https://vk.ru/ads?country=ua' }),
      ];
      const terms = new Terms({ service, type: termsType, sourceDocuments });

      expect(terms.duplicateSourceDocuments).to.deep.equal([ sourceDocuments[1], sourceDocuments[3] ]);
    });
  });
});
