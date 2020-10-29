import chai from 'chai';

import { extractCssSelectorsFromDocumentDeclaration } from './index.js';

const { expect } = chai;

describe('Utils', () => {
  describe('#extractCssSelectorsFromDocumentDeclaration', () => {
    context('With "select" property', () => {
      context('With string selector', () => {
        it('extracts selectors', async () => {
          const result = extractCssSelectorsFromDocumentDeclaration({
            select: 'body'
          });

          expect(result).to.deep.equal([ 'body' ]);
        });
      });

      context('With range selector', () => {
        it('extracts selectors', async () => {
          const result = extractCssSelectorsFromDocumentDeclaration({
            select: {
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
            select: [
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
            remove: 'body'
          });

          expect(result).to.deep.equal([ 'body' ]);
        });
      });

      context('With range selector', () => {
        it('extracts selectors', async () => {
          const result = extractCssSelectorsFromDocumentDeclaration({
            remove: {
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
            remove: [
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
            select: 'body',
            remove: 'h1'
          });

          expect(result).to.deep.equal([ 'body', 'h1' ]);
        });
      });

      context('With range selector', () => {
        it('extracts selectors', async () => {
          const result = extractCssSelectorsFromDocumentDeclaration({
            select: {
              startBefore: '#startBefore',
              endBefore: '#endBefore'
            },
            remove: {
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
            select: [
              {
                startBefore: '#startBefore',
                endBefore: '#endBefore'
              },
              'body'
            ],
            remove: [
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
