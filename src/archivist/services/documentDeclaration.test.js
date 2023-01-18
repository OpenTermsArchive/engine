import chai from 'chai';

import DocumentDeclaration from './documentDeclaration.js';
import PageDeclaration from './pageDeclaration.js';

const { expect } = chai;

describe('DocumentDeclaration', () => {
  const service = { name: 'Service' };
  const termsType = 'Terms of Service';
  const URL = 'https://www.service.example/terms';
  const page1 = new PageDeclaration({
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
  const page1AsJSON = {
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

  const page2 = new PageDeclaration({
    location: URL,
    contentSelectors: 'body',
  });

  const page2AsJSON = {
    fetch: URL,
    select: 'body',
    remove: undefined,
    filter: undefined,
    executeClientScripts: undefined,
  };

  describe('#toPersistence', () => {
    it('converts one page document to JSON representation', async () => {
      const result = new DocumentDeclaration({ service, termsType, pages: [page1] }).toPersistence();

      const expectedResult = {
        name: service.name,
        documents: { [termsType]: page1AsJSON },
      };

      expect(result).to.deep.equal(expectedResult);
    });

    it('converts multipage document to JSON representation', async () => {
      const result = new DocumentDeclaration({ service, termsType, pages: [ page1, page2 ] }).toPersistence();

      const expectedResult = {
        name: service.name,
        documents: { [termsType]: { combine: [ page1AsJSON, page2AsJSON ] } },
      };

      expect(result).to.deep.equal(expectedResult);
    });
  });
});
