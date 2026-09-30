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
    it('returns the source documents that repeat a location', () => {
      const terms = new Terms({ service, type: termsType, sourceDocuments: [ document1, document2 ] });

      expect(terms.duplicateSourceDocuments).to.deep.equal([document2]);
    });

    [
      [ 'different hosts', 'https://www.service.example/terms', 'https://accounts.service.example/terms' ],
      [ 'different query strings', 'https://www.service.example/ads?page=1', 'https://www.service.example/ads?page=2' ],
      [ 'different file extensions', 'https://www.service.example/terms.html', 'https://www.service.example/terms.pdf' ],
      [ 'different path separators', 'https://www.service.example/legal/terms', 'https://www.service.example/legal-terms' ],
    ].forEach(([ description, firstLocation, secondLocation ]) => {
      it(`returns source documents with colliding IDs from ${description}`, () => {
        const firstDocument = new SourceDocument({ location: firstLocation });
        const secondDocument = new SourceDocument({ location: secondLocation });
        const terms = new Terms({ service, type: termsType, sourceDocuments: [ firstDocument, secondDocument ] });

        expect(terms.duplicateSourceDocuments).to.deep.equal([secondDocument]);
      });
    });

    it('does not return source documents with distinct IDs', () => {
      const distinctDocument = new SourceDocument({ location: 'https://www.service.example/privacy' });
      const terms = new Terms({ service, type: termsType, sourceDocuments: [ document1, distinctDocument ] });

      expect(terms.duplicateSourceDocuments).to.be.empty;
    });
  });
});
