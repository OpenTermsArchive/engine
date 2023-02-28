import chai from 'chai';

import SourceDocument from './sourceDocument.js';
import Terms from './terms.js';

const { expect } = chai;

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
    it('converts terms with only one source document to JSON representation', async () => {
      const result = new Terms({ service, termsType, sourceDocuments: [document1] }).toPersistence();

      const expectedResult = {
        name: service.name,
        documents: { [termsType]: document1AsJSON },
      };

      expect(result).to.deep.equal(expectedResult);
    });

    it('converts terms with multiple source documents to JSON representation', async () => {
      const result = new Terms({ service, termsType, sourceDocuments: [ document1, document2 ] }).toPersistence();

      const expectedResult = {
        name: service.name,
        documents: { [termsType]: { combine: [ document1AsJSON, document2AsJSON ] } },
      };

      expect(result).to.deep.equal(expectedResult);
    });
  });
});
