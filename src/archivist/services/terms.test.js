import chai from 'chai';

import Document from './document.js';
import Terms from './terms.js';

const { expect } = chai;

describe('Terms', () => {
  const service = { name: 'Service' };
  const termsType = 'Terms of Service';
  const URL = 'https://www.service.example/terms';
  const document1 = new Document({
    location: URL,
    contentSelectors: [
      {
        startBefore: '#startBefore',
        endBefore: '#endBefore',
      },
      'body',
    ],
    noiseSelectors: [
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

  const document2 = new Document({
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
    it('converts document with only one terms to JSON representation', async () => {
      const result = new Terms({ service, termsType, documents: [document1] }).toPersistence();

      const expectedResult = {
        name: service.name,
        documents: { [termsType]: document1AsJSON },
      };

      expect(result).to.deep.equal(expectedResult);
    });

    it('converts document with multiple documents to JSON representation', async () => {
      const result = new Terms({ service, termsType, documents: [ document1, document2 ] }).toPersistence();

      const expectedResult = {
        name: service.name,
        documents: { [termsType]: { combine: [ document1AsJSON, document2AsJSON ] } },
      };

      expect(result).to.deep.equal(expectedResult);
    });
  });
});
