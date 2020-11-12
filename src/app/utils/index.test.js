import chai from 'chai';

import { extractCssSelectorsFromDocumentDeclaration } from './index.js';

const { expect } = chai;

describe('Utils', () => {
  describe('#extractCssSelectorsFromDocumentDeclaration', () => {
    context('With "select" property', () => {
      context('With string selector', () => {
        it('extracts selectors', async () => {
          const result = extractCssSelectorsFromDocumentDeclaration({
            contentSelectors: 'body'
          });

          expect(result).to.deep.equal([ 'body' ]);
        });
      });

      context('With range selector', () => {
        it('extracts selectors', async () => {
          const result = extractCssSelectorsFromDocumentDeclaration({
            contentSelectors: {
              startBefore: '#startBefore',
              endBefore: '#endBefore'
            }
          });

          expect(result).to.deep.equal([ '#startBefore', '#endBefore' ]);
        });
      });

      context('With an array of mixed selectors', () => {
        it('extracts selectors', async () => {
          const result = extractCssSelectorsFromDocumentDeclaration({
            contentSelectors: [
              {
                startBefore: '#startBefore',
                endBefore: '#endBefore'
              },
              'body'
            ]
          });

          expect(result).to.deep.equal([ '#startBefore', '#endBefore', 'body' ]);
        });
      });
    });

    context('With "remove" property', () => {
      context('With string selector', () => {
        it('extracts selectors', async () => {
          const result = extractCssSelectorsFromDocumentDeclaration({
            noiseSelectors: 'body'
          });

          expect(result).to.deep.equal([ 'body' ]);
        });
      });

      context('With range selector', () => {
        it('extracts selectors', async () => {
          const result = extractCssSelectorsFromDocumentDeclaration({
            noiseSelectors: {
              startBefore: '#startBefore',
              endBefore: '#endBefore'
            }
          });

          expect(result).to.deep.equal([ '#startBefore', '#endBefore' ]);
        });
      });

      context('With an array of mixed selectors', () => {
        it('extracts selectors', async () => {
          const result = extractCssSelectorsFromDocumentDeclaration({
            noiseSelectors: [
              {
                startBefore: '#startBefore',
                endBefore: '#endBefore'
              },
              'body'
            ]
          });

          expect(result).to.deep.equal([ '#startBefore', '#endBefore', 'body' ]);
        });
      });
    });

    context('With both "select" and "remove" property', () => {
      context('With string selector', () => {
        it('extracts selectors', async () => {
          const result = extractCssSelectorsFromDocumentDeclaration({
            contentSelectors: 'body',
            noiseSelectors: 'h1'
          });

          expect(result).to.deep.equal([ 'body', 'h1' ]);
        });
      });

      context('With range selector', () => {
        it('extracts selectors', async () => {
          const result = extractCssSelectorsFromDocumentDeclaration({
            contentSelectors: {
              startBefore: '#startBefore',
              endBefore: '#endBefore'
            },
            noiseSelectors: {
              startBefore: '#startBefore',
              endBefore: '#endBefore'
            }
          });

          expect(result).to.deep.equal([ '#startBefore', '#endBefore', '#startBefore', '#endBefore' ]);
        });
      });

      context('With an array of mixed selectors', () => {
        it('extracts selectors', async () => {
          const result = extractCssSelectorsFromDocumentDeclaration({
            contentSelectors: [
              {
                startBefore: '#startBefore',
                endBefore: '#endBefore'
              },
              'body'
            ],
            noiseSelectors: [
              {
                startBefore: '#startBefore',
                endBefore: '#endBefore'
              },
              'body'
            ]
          });

          expect(result).to.deep.equal([ '#startBefore', '#endBefore', 'body', '#startBefore', '#endBefore', 'body' ]);
        });
      });
    });
  });
});
