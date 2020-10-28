import fsApi from 'fs';
import path from 'path';

import chai from 'chai';
import jsdom from 'jsdom';
import { fileURLToPath } from 'url';

import { filterHTML, filterPDF, convertRelativeURLsToAbsolute } from './index.js';
import { InaccessibleContentError } from '../errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fs = fsApi.promises;
const { JSDOM } = jsdom;
const { expect } = chai;

const virtualLocation = 'https://exemple.com/main';
const rawHTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>TOS</title>
  </head>
  <body>
    <h1>Title</h1>
    <p><a id="link1" href="/relative/link">link 1</a></p>
    <p><a id="link2" href="#anchor">link 2</a></p>
    <p><a id="link3" href="http://absolute.url/link">link 3</a></p>
  </body>
</html>`;

const expectedFiltered = `Title
=====

[link 1](https://exemple.com/relative/link)

[link 2](#anchor)

[link 3](http://absolute.url/link)`;

const expectedFilteredWithAdditional = `Title
=====`;

const additionalFilter = {
  removeLinks: function removeLinks(document) {
    const links = document.querySelectorAll('a');
    links.forEach(link => {
      link.remove();
    });
  },
  removeLinksAsync: async function removeLinksAsync(document) {
    return new Promise(resolve => {
      setTimeout(() => {
        const links = document.querySelectorAll('a');
        links.forEach(link => {
          link.remove();
        });
        resolve();
      }, 300);
    });
  }
};

describe('Filter', () => {
  describe('#convertRelativeURLsToAbsolute', () => {
    let subject;
    before(() => {
      const { document: webPageDOM } = new JSDOM(rawHTML).window;
      convertRelativeURLsToAbsolute(webPageDOM, virtualLocation);
      subject = Array.from(webPageDOM.querySelectorAll('a[href]')).map(el => el.href);
    });

    it('converts relative urls', async () => {
      expect(subject).to.include('https://exemple.com/relative/link');
    });

    it('leaves absolute urls untouched', async () => {
      expect(subject).to.include('http://absolute.url/link');
    });
  });

  describe('#filterHTML', () => {
    context('With string selector', () => {
      it('filters the given HTML content', async () => {
        const result = await filterHTML({
          content: rawHTML,
          documentDeclaration: { fetch: virtualLocation, select: 'body' }
        });
        expect(result).to.equal(expectedFiltered);
      });

      context('With no match for the given selector', () => {
        it('throws an InaccessibleContentError error', async () => {
          await expect(filterHTML({
            content: rawHTML,
            documentDeclaration: { fetch: virtualLocation, select: '#thisAnchorDoesNotExist' }
          })).to.be.rejectedWith(InaccessibleContentError, /#thisAnchorDoesNotExist/);
        });
      });

      context('With an additional filter', () => {
        it('filters the given HTML content also with given additional filter', async () => {
          const result = await filterHTML({
            content: rawHTML,
            documentDeclaration: { fetch: virtualLocation, select: 'body', filter: [ 'removeLinks' ] },
            filterFunctions: additionalFilter
          });
          expect(result).to.equal(expectedFilteredWithAdditional);
        });
      });

      context('With an additional async filter', () => {
        it('filters the given HTML content also with given additional filter', async () => {
          const result = await filterHTML({
            content: rawHTML,
            documentDeclaration: { fetch: virtualLocation, select: 'body', filter: [ 'removeLinksAsync' ] },
            filterFunctions: additionalFilter
          });
          expect(result).to.equal(expectedFilteredWithAdditional);
        });
      });

      context('With multiple selectors in one string', () => {
        it('filters the given HTML content', async () => {
          const result = await filterHTML({
            content: rawHTML,
            documentDeclaration: { fetch: virtualLocation, select: 'h1, #link2' }
          });
          expect(result).to.equal('Title\n=====\n\n[link 2](#anchor)');
        });
      });
    });

    context('With an array of selectors', () => {
      it('filters the given HTML content', async () => {
        const result = await filterHTML({
          content: rawHTML,
          documentDeclaration: { fetch: virtualLocation, select: [ 'h1', '#link2' ] }
        });
        expect(result).to.equal('Title\n=====\n\n[link 2](#anchor)');
      });
    });

    context('With range selector', () => {
      context('With startBefore and endBefore', () => {
        it('filters the given HTML content', async () => {
          const result = await filterHTML({
            content: rawHTML,
            documentDeclaration: {
              fetch: virtualLocation,
              select: {
                startBefore: '#link1',
                endBefore: '#link2'
              }
            }
          });
          expect(result).to.equal('[link 1](https://exemple.com/relative/link)');
        });
      });
      context('With startBefore and endAfter', () => {
        it('filters the given HTML content', async () => {
          const result = await filterHTML({
            content: rawHTML,
            documentDeclaration: {
              fetch: virtualLocation,
              select: {
                startBefore: '#link2',
                endAfter: '#link2'
              }
            }
          });
          expect(result).to.equal('[link 2](#anchor)');
        });
      });
      context('With startAfter and endBefore', () => {
        it('filters the given HTML content', async () => {
          const result = await filterHTML({
            content: rawHTML,
            documentDeclaration: {
              fetch: virtualLocation,
              select: {
                startAfter: '#link1',
                endBefore: '#link3'
              }
            }
          });
          expect(result).to.equal('[link 2](#anchor)');
        });
      });
      context('With startAfter and endAfter', () => {
        it('filters the given HTML content', async () => {
          const result = await filterHTML({
            content: rawHTML,
            documentDeclaration: {
              fetch: virtualLocation,
              select: {
                startAfter: '#link2',
                endAfter: '#link3'
              }
            }
          });
          expect(result).to.equal('[link 3](http://absolute.url/link)');
        });
      });
      context('With a "start" selector that has no match', () => {
        it('throws an InaccessibleContentError error', async () => {
          await expect(filterHTML({
            content: rawHTML,
            documentDeclaration: {
              fetch: virtualLocation,
              select: {
                startAfter: '#paragraph1',
                endAfter: '#link2'
              }
            }
          })).to.be.rejectedWith(InaccessibleContentError, /"start" selector has no match/);
        });
      });
      context('With an "end" selector that has no match', () => {
        it('throws an InaccessibleContentError error', async () => {
          await expect(filterHTML({
            content: rawHTML,
            documentDeclaration: {
              fetch: virtualLocation,
              select: {
                startAfter: '#link2',
                endAfter: '#paragraph1'
              }
            }
          })).to.be.rejectedWith(InaccessibleContentError, /"end" selector has no match/);
        });
      });
    });

    context('With an array of range selectors', () => {
      it('filters the given HTML content', async () => {
        const result = await filterHTML({
          content: rawHTML,
          documentDeclaration: {
            fetch: virtualLocation,
            select: [{
              startAfter: '#link1',
              endAfter: '#link2'
            }, {
              startAfter: '#link2',
              endAfter: '#link3'
            }]
          }
        });
        expect(result).to.equal('[link 2](#anchor)\n\n[link 3](http://absolute.url/link)');
      });
    });

    context('With an array of mixed string selectors and range selectors', () => {
      it('filters the given HTML content', async () => {
        const result = await filterHTML({
          content: rawHTML,
          documentDeclaration: {
            fetch: virtualLocation,
            select: [ 'h1', {
              startAfter: '#link2',
              endAfter: '#link3'
            }]
          }
        });
        expect(result).to.equal('Title\n=====\n\n[link 3](http://absolute.url/link)');
      });
    });

    describe('Remove elements', () => {
      context('With a simple selector', () => {
        it('removes the specified elements', async () => {
          const result = await filterHTML({
            content: rawHTML,
            documentDeclaration: {
              fetch: virtualLocation,
              select: 'body',
              remove: 'h1'
            }
          });
          expect(result).to.equal('[link 1](https://exemple.com/relative/link)\n\n[link 2](#anchor)\n\n[link 3](http://absolute.url/link)');
        });
      });

      context('With an array of string selectors', () => {
        it('removes the specified elements', async () => {
          const result = await filterHTML({
            content: rawHTML,
            documentDeclaration: {
              fetch: virtualLocation,
              select: 'body',
              remove: [
                'h1', '#link3'
              ]
            }
          });
          expect(result).to.equal('[link 1](https://exemple.com/relative/link)\n\n[link 2](#anchor)');
        });
      });

      context('With a simple range selector', () => {
        it('removes the specified elements', async () => {
          const result = await filterHTML({
            content: rawHTML,
            documentDeclaration: {
              fetch: virtualLocation,
              select: 'body',
              remove: {
                startBefore: '#link1',
                endAfter: '#link3'
              }
            }
          });
          expect(result).to.equal('Title\n=====');
        });
        context('With a "start" selector that has no match', () => {
          it('throws an InaccessibleContentError error', async () => {
            await expect(filterHTML({
              content: rawHTML,
              documentDeclaration: {
                fetch: virtualLocation,
                select: 'body',
                remove: {
                  startAfter: '#paragraph1',
                  endAfter: '#link2'
                }
              }
            })).to.be.rejectedWith(InaccessibleContentError, /"start" selector has no match/);
          });
        });
        context('With an "end" selector that has no match', () => {
          it('throws an InaccessibleContentError error', async () => {
            await expect(filterHTML({
              content: rawHTML,
              documentDeclaration: {
                fetch: virtualLocation,
                select: 'body',
                remove: {
                  startAfter: '#link2',
                  endAfter: '#paragraph1'
                }
              }
            })).to.be.rejectedWith(InaccessibleContentError, /"end" selector has no match/);
          });
        });
      });
      context('With an array of range selectors', () => {
        it('removes all the selections', async () => {
          const result = await filterHTML({
            content: rawHTML,
            documentDeclaration: {
              fetch: virtualLocation,
              select: 'body',
              remove: [
                {
                  startBefore: 'h1',
                  endBefore: '#link1'
                },
                {
                  startBefore: '#link3',
                  endAfter: '#link3'
                }
              ]
            }
          });
          expect(result).to.equal('[link 1](https://exemple.com/relative/link)\n\n[link 2](#anchor)');
        });
      });

      context('With an array of mixed selectors and range selectors', () => {
        it('removes all the selections', async () => {
          const result = await filterHTML({
            content: rawHTML,
            documentDeclaration: {
              fetch: virtualLocation,
              select: 'body',
              remove: [
                'h1',
                {
                  startBefore: '#link3',
                  endAfter: '#link3'
                }
              ]
            }
          });
          expect(result).to.equal('[link 1](https://exemple.com/relative/link)\n\n[link 2](#anchor)');
        });
      });
    });
  });

  describe('#filterPDF', () => {
    let pdfContent;
    let expectedFilteredContent;

    before(async () => {
      pdfContent = await fs.readFile(path.resolve(__dirname, '../../../test/fixtures/terms.pdf'));
      expectedFilteredContent = await fs.readFile(path.resolve(__dirname, '../../../test/fixtures/termsFromPDF.md'), { encoding: 'utf8' });
    });

    it('filters the given PDF', async () => {
      expect(await filterPDF({ content: pdfContent })).to.equal(expectedFilteredContent);
    });
  });
});
