import chai from 'chai';

import PageDeclaration from './pageDeclaration.js';

const { expect } = chai;

describe('PageDeclaration', () => {
  const URL = 'https://www.service.example/terms';

  describe('#getCssSelectors', () => {
    context('with "select" property', () => {
      context('with string selector', () => {
        it('extracts selectors', async () => {
          const result = new PageDeclaration({ location: URL, contentSelectors: 'body' }).cssSelectors;

          expect(result).to.deep.equal(['body']);
        });
      });

      context('with range selector', () => {
        it('extracts selectors', async () => {
          const result = new PageDeclaration({
            location: URL,
            contentSelectors: {
              startBefore: '#startBefore',
              endBefore: '#endBefore',
            },
          }).cssSelectors;

          expect(result).to.deep.equal([ '#startBefore', '#endBefore' ]);
        });
      });

      context('with an array of mixed selectors', () => {
        it('extracts selectors', async () => {
          const result = new PageDeclaration({
            location: URL,
            contentSelectors: [
              {
                startBefore: '#startBefore',
                endBefore: '#endBefore',
              },
              'body',
            ],
          }).cssSelectors;

          expect(result).to.deep.equal([ '#startBefore', '#endBefore', 'body' ]);
        });
      });
    });

    context('with "remove" property', () => {
      context('with string selector', () => {
        it('extracts selectors', async () => {
          const result = new PageDeclaration({ location: URL, noiseSelectors: 'body' }).cssSelectors;

          expect(result).to.deep.equal(['body']);
        });
      });

      context('with range selector', () => {
        it('extracts selectors', async () => {
          const result = new PageDeclaration({
            location: URL,
            noiseSelectors: {
              startBefore: '#startBefore',
              endBefore: '#endBefore',
            },
          }).cssSelectors;

          expect(result).to.deep.equal([ '#startBefore', '#endBefore' ]);
        });
      });

      context('with an array of mixed selectors', () => {
        it('extracts selectors', async () => {
          const result = new PageDeclaration({
            location: URL,
            noiseSelectors: [
              {
                startBefore: '#startBefore',
                endBefore: '#endBefore',
              },
              'body',
            ],
          }).cssSelectors;

          expect(result).to.deep.equal([ '#startBefore', '#endBefore', 'body' ]);
        });
      });
    });

    context('with both "select" and "remove" property', () => {
      context('with string selector', () => {
        it('extracts selectors', async () => {
          const result = new PageDeclaration({
            location: URL,
            contentSelectors: 'body',
            noiseSelectors: 'h1',
          }).cssSelectors;

          expect(result).to.deep.equal([ 'body', 'h1' ]);
        });
      });

      context('with range selector', () => {
        it('extracts selectors', async () => {
          const result = new PageDeclaration({
            location: URL,
            contentSelectors: {
              startBefore: '#startBefore',
              endBefore: '#endBefore',
            },
            noiseSelectors: {
              startBefore: '#startBefore',
              endBefore: '#endBefore',
            },
          }).cssSelectors;

          expect(result).to.deep.equal([
            '#startBefore',
            '#endBefore',
            '#startBefore',
            '#endBefore',
          ]);
        });
      });

      context('with an array of mixed selectors', () => {
        it('extracts selectors', async () => {
          const result = new PageDeclaration({
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
          }).cssSelectors;

          expect(result).to.deep.equal([
            '#startBefore',
            '#endBefore',
            'body',
            '#startBefore',
            '#endBefore',
            'body',
          ]);
        });
      });
    });
  });

    it('convert noise and content semectors to JSON', async () => {
  describe('toPersistence', () => {
      const result = new PageDeclaration({
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
      }).toPersistence();

      const expectedResult = {
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

      expect(result).to.deep.equal(expectedResult);
    });

    it('convert filter functions to JSON', async () => {
      const result = new PageDeclaration({
        location: URL,
        contentSelectors: 'body',
        filters: [function filterSomething() {}],
      }).toPersistence();

      const expectedResult = {
        fetch: URL,
        select: 'body',
        remove: undefined,
        filter: ['filterSomething'],
        executeClientScripts: undefined,
      };

      expect(result).to.deep.equal(expectedResult);
    });
  });
});
