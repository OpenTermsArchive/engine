import chai from 'chai';

import Document from './document.js';

const { expect } = chai;

describe('Document', () => {
  const URL = 'https://www.service.example/terms';

  describe('#getCssSelectors', () => {
    context('with "select" property', () => {
      context('with string selector', () => {
        it('extracts selectors', async () => {
          const result = new Document({ location: URL, contentSelectors: 'body' }).cssSelectors;

          expect(result).to.deep.equal(['body']);
        });
      });

      context('with range selector', () => {
        it('extracts selectors', async () => {
          const result = new Document({
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
          const result = new Document({
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
          const result = new Document({ location: URL, noiseSelectors: 'body' }).cssSelectors;

          expect(result).to.deep.equal(['body']);
        });
      });

      context('with range selector', () => {
        it('extracts selectors', async () => {
          const result = new Document({
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
          const result = new Document({
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
          const result = new Document({
            location: URL,
            contentSelectors: 'body',
            noiseSelectors: 'h1',
          }).cssSelectors;

          expect(result).to.deep.equal([ 'body', 'h1' ]);
        });
      });

      context('with range selector', () => {
        it('extracts selectors', async () => {
          const result = new Document({
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
          const result = new Document({
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

  describe('#toPersistence', () => {
    it('converts basic page declaration into JSON representation', async () => {
      const result = new Document({
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

    it('converts page declaration with all fields to JSON representation', async () => {
      const result = new Document({
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
