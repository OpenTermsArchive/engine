import { expect } from 'chai';

import SourceDocument from './sourceDocument.js';

describe('SourceDocument', () => {
  const URL = 'https://www.service.example/terms';

  describe('#getCssSelectors', () => {
    context('with "select" property', () => {
      context('with string selector', () => {
        it('extracts selectors', () => {
          const result = new SourceDocument({ location: URL, contentSelectors: 'body' }).cssSelectors;

          expect(result).to.deep.equal(['body']);
        });
      });

      context('with range selector', () => {
        it('extracts selectors', () => {
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
        it('extracts selectors', () => {
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
        it('extracts selectors', () => {
          const result = new SourceDocument({ location: URL, insignificantContentSelectors: 'body' }).cssSelectors;

          expect(result).to.deep.equal(['body']);
        });
      });

      context('with range selector', () => {
        it('extracts selectors', () => {
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
        it('extracts selectors', () => {
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
        it('extracts selectors', () => {
          const result = new SourceDocument({
            location: URL,
            contentSelectors: 'body',
            insignificantContentSelectors: 'h1',
          }).cssSelectors;

          expect(result).to.deep.equal([ 'body', 'h1' ]);
        });
      });

      context('with range selector', () => {
        it('extracts selectors', () => {
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
        it('extracts selectors', () => {
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

  describe('#generateId', () => {
    it('generates ID from URL pathname', () => {
      expect(new SourceDocument({ location: 'https://example.com/legal/terms' }).id).to.equal('legal-terms');
    });

    it('returns empty string for root URL', () => {
      expect(new SourceDocument({ location: 'https://example.com/' }).id).to.equal('');
    });

    it('decodes URL-encoded characters', () => {
      expect(new SourceDocument({ location: 'https://example.com/terms%20of%20service' }).id).to.equal('terms of service');
    });

    it('removes known file extension from URL pathname', () => {
      expect(new SourceDocument({ location: 'https://example.com/en.html' }).id).to.equal('en');
    });

    it('removes only the last file extension', () => {
      expect(new SourceDocument({ location: 'https://example.com/terms.backup.html' }).id).to.equal('terms.backup');
    });

    it('keeps unknown extension in URL pathname', () => {
      expect(new SourceDocument({ location: 'https://example.com/terms.of.service' }).id).to.equal('terms.of.service');
    });
    it('decodes URL-encoded characters before replacing illegal ones', () => {
      expect(new SourceDocument({ location: 'https://example.com/terms%3Aof%3Aservice' }).id).to.equal('terms_of_service');
    });

    context('replaces characters that are illegal in filenames for cross-platform compatibility', () => {
      const ILLEGAL_CHARACTERS_IN_URL_PATHNAME = {
        ':': 'colon',
        '"': 'double quote',
        '<': 'less than',
        '>': 'greater than',
        '|': 'vertical bar',
        '*': 'asterisk',
      };

      for (const [ character, name ] of Object.entries(ILLEGAL_CHARACTERS_IN_URL_PATHNAME)) {
        it(`replaces ${name} "${character}"`, () => {
          expect(new SourceDocument({ location: `https://example.com/before${character}after` }).id).to.equal('before_after');
        });
      }

      const ILLEGAL_CHARACTERS_ENCODED_IN_URL = {
        '%5C': 'backslash',
        '%3F': 'question mark',
      };

      for (const [ encoded, name ] of Object.entries(ILLEGAL_CHARACTERS_ENCODED_IN_URL)) {
        it(`replaces ${name} decoded from "${encoded}"`, () => {
          expect(new SourceDocument({ location: `https://example.com/before${encoded}after` }).id).to.equal('before_after');
        });
      }
    });
  });

  describe('#toPersistence', () => {
    it('converts basic source document declarations into JSON representation', () => {
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

    it('converts full source document declarations to JSON representation', () => {
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
