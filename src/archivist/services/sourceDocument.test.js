import chai from 'chai';

import SourceDocument from './sourceDocument.js';

const { expect } = chai;

describe('SourceDocument', () => {
  const URL = 'https://www.service.example/terms';

  describe('#getCssSelectors', () => {
    context('with "select" property', () => {
      context('with string selector', () => {
        it('extracts selectors', async () => {
          const result = new SourceDocument({ location: URL, contentSelectors: 'body' }).cssSelectors;

          expect(result).to.deep.equal(['body']);
        });
      });

      context('with range selector', () => {
        it('extracts selectors', async () => {
          const result = new SourceDocument({
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
          const result = new SourceDocument({
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
          const result = new SourceDocument({ location: URL, insignificantContentSelectors: 'body' }).cssSelectors;

          expect(result).to.deep.equal(['body']);
        });
      });

      context('with range selector', () => {
        it('extracts selectors', async () => {
          const result = new SourceDocument({
            location: URL,
            insignificantContentSelectors: {
              startBefore: '#startBefore',
              endBefore: '#endBefore',
            },
          }).cssSelectors;

          expect(result).to.deep.equal([ '#startBefore', '#endBefore' ]);
        });
      });

      context('with an array of mixed selectors', () => {
        it('extracts selectors', async () => {
          const result = new SourceDocument({
            location: URL,
            insignificantContentSelectors: [
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
          const result = new SourceDocument({
            location: URL,
            contentSelectors: 'body',
            insignificantContentSelectors: 'h1',
          }).cssSelectors;

          expect(result).to.deep.equal([ 'body', 'h1' ]);
        });
      });

      context('with range selector', () => {
        it('extracts selectors', async () => {
          const result = new SourceDocument({
            location: URL,
            contentSelectors: {
              startBefore: '#startBefore',
              endBefore: '#endBefore',
            },
            insignificantContentSelectors: {
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
          const result = new SourceDocument({
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

  describe('#toPersistence', () => {
    it('converts basic source document declarations into JSON representation', async () => {
      const result = new SourceDocument({
        location: URL,
        contentSelectors: 'body',
      }).toPersistence();

      const expectedResult = {
        fetch: URL,
        select: 'body',
        remove: undefined,
        filter: undefined,
        executeClientScripts: undefined,
      };

      expect(result).to.deep.equal(expectedResult);
    });

    it('converts full source document declarations to JSON representation', async () => {
      const result = new SourceDocument({
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
        filters: [function filterSomething() {}],
        executeClientScripts: true,
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
        filter: ['filterSomething'],
        executeClientScripts: true,
      };

      expect(result).to.deep.equal(expectedResult);
    });
  });
});
