import chai from 'chai';
import DocumentDeclaration from './documentDeclaration.js';

const { expect } = chai;

describe('DocumentDeclaration', () => {
  describe('#extractCssSelectors', () => {
    context('With "select" property', () => {
      context('With string selector', () => {
        it('extracts selectors', async () => {
          const result = new DocumentDeclaration({ contentSelectors: 'body' }).getCssSelectors();

          expect(result).to.deep.equal(['body']);
        });
      });

      context('With range selector', () => {
        it('extracts selectors', async () => {
          const result = new DocumentDeclaration({
            contentSelectors: {
              startBefore: '#startBefore',
              endBefore: '#endBefore',
            },
          }).getCssSelectors();

          expect(result).to.deep.equal(['#startBefore', '#endBefore']);
        });
      });

      context('With an array of mixed selectors', () => {
        it('extracts selectors', async () => {
          const result = new DocumentDeclaration({
            contentSelectors: [
              {
                startBefore: '#startBefore',
                endBefore: '#endBefore',
              },
              'body',
            ],
          }).getCssSelectors();

          expect(result).to.deep.equal(['#startBefore', '#endBefore', 'body']);
        });
      });
    });

    context('With "remove" property', () => {
      context('With string selector', () => {
        it('extracts selectors', async () => {
          const result = new DocumentDeclaration({
            noiseSelectors: 'body',
          }).getCssSelectors();

          expect(result).to.deep.equal(['body']);
        });
      });

      context('With range selector', () => {
        it('extracts selectors', async () => {
          const result = new DocumentDeclaration({
            noiseSelectors: {
              startBefore: '#startBefore',
              endBefore: '#endBefore',
            },
          }).getCssSelectors();

          expect(result).to.deep.equal(['#startBefore', '#endBefore']);
        });
      });

      context('With an array of mixed selectors', () => {
        it('extracts selectors', async () => {
          const result = new DocumentDeclaration({
            noiseSelectors: [
              {
                startBefore: '#startBefore',
                endBefore: '#endBefore',
              },
              'body',
            ],
          }).getCssSelectors();

          expect(result).to.deep.equal(['#startBefore', '#endBefore', 'body']);
        });
      });
    });

    context('With both "select" and "remove" property', () => {
      context('With string selector', () => {
        it('extracts selectors', async () => {
          const result = new DocumentDeclaration({
            contentSelectors: 'body',
            noiseSelectors: 'h1',
          }).getCssSelectors();

          expect(result).to.deep.equal(['body', 'h1']);
        });
      });

      context('With range selector', () => {
        it('extracts selectors', async () => {
          const result = new DocumentDeclaration({
            contentSelectors: {
              startBefore: '#startBefore',
              endBefore: '#endBefore',
            },
            noiseSelectors: {
              startBefore: '#startBefore',
              endBefore: '#endBefore',
            },
          }).getCssSelectors();

          expect(result).to.deep.equal([
            '#startBefore',
            '#endBefore',
            '#startBefore',
            '#endBefore',
          ]);
        });
      });

      context('With an array of mixed selectors', () => {
        it('extracts selectors', async () => {
          const result = new DocumentDeclaration({
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
          }).getCssSelectors();

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
});
