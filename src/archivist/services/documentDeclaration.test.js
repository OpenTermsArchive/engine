import chai from 'chai';

import DocumentDeclaration from './documentDeclaration.js';
import PageDeclaration from './pageDeclaration.js';

const { expect } = chai;

describe('PageDeclaration', () => {
  const service = { name: 'Service' };
  const type = 'Terms of Service';
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

  describe('toJSON', () => {
    it('convert one page document to JSON', async () => {
      const result = new DocumentDeclaration({ service, type, pages: [page1] }).toJSON();

      const expectedResult = {
        name: service.name,
        documents: { [type]: page1AsJSON },
      };

      expect(result).to.deep.equal(expectedResult);
    });

    it('convert multi page document to JSON', async () => {
      const result = new DocumentDeclaration({ service, type, pages: [ page1, page2 ] }).toJSON();

      const expectedResult = {
        name: service.name,
        documents: { [type]: { combine: [ page1AsJSON, page2AsJSON ] } },
      };

      expect(result).to.deep.equal(expectedResult);
    });
  });
});
