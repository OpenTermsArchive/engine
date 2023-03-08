import fsApi from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import chai from 'chai';
import jsdom from 'jsdom';

import { InaccessibleContentError } from '../errors.js';
import SourceDocument from '../services/sourceDocument.js';

import { convertRelativeURLsToAbsolute, extractFromHTML, extractFromPDF } from './index.js';

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
    <div id="empty"></div>
    <div id="whitespaceOnly"> </div>
  </body>
</html>`;

const expectedExtracted = `Title
=====

[link 1](https://exemple.com/relative/link)

[link 2](#anchor)

[link 3](http://absolute.url/link)`;

const expectedExtractedWithAdditional = `Title
=====`;

const rawHTMLWithCommonChangingItems = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>TOS</title>
    <style>body { background: red }</style>
    <script>console.log("test")</script>
  </head>
  <body>
    <style>body { background: blue }</style>
    <script>console.log("test")</script>
    <h1>Title</h1>
    <p><a id="link1" href="/relative/link">link 1</a></p>
    <p><a id="link2" href="#anchor">link 2</a></p>
    <p><a id="link3" href="http://absolute.url/link">link 3</a></p>
    <p><a id="link4" href="">link 4</a></p>
    <a href="/cdn-cgi/l/email-protection#3b4c52555f484f495e5a56154b49524d5a584215484f5a4f5e565e554f7b4c52555f484f495e5a5615585456">[email&#160;protected]</a>
    <p><a href="/cdn-cgi/l/email-protection#2d4e4243594c4e596d4e4459545e4e424259034858">conta<span>[email&#160;protected]</span></a></p>
  </body>
</html>`;

/* eslint-disable no-irregular-whitespace */
const expectedExtractedWithCommonChangingItems = `Title
=====

[link 1](https://exemple.com/relative/link)

[link 2](#anchor)

[link 3](http://absolute.url/link)

link 4

[\\[email protected\\]](https://exemple.com/cdn-cgi/l/email-protection)

[\\[email protected\\]](https://exemple.com/cdn-cgi/l/email-protection)`;
/* eslint-enable no-irregular-whitespace */

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
  },
};

describe('Extract', () => {
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

  describe('#extractFromHTML', () => {
    describe('Select', () => {
      context('with string selector', () => {
        it('extracts content from the given HTML with common changing items', async () => {
          const result = await extractFromHTML({
            content: rawHTMLWithCommonChangingItems,
            sourceDocument: new SourceDocument({
              location: virtualLocation,
              contentSelectors: 'body',
            }),
          });

          expect(result).to.equal(expectedExtractedWithCommonChangingItems);
        });

        it('extracts content from the given HTML', async () => {
          const result = await extractFromHTML({
            content: rawHTML,
            sourceDocument: new SourceDocument({
              location: virtualLocation,
              contentSelectors: 'body',
            }),
          });

          expect(result).to.equal(expectedExtracted);
        });

        context('with no match for the given selector', () => {
          it('throws an InaccessibleContentError error', async () => {
            await expect(extractFromHTML({
              content: rawHTML,
              sourceDocument: new SourceDocument({
                location: virtualLocation,
                contentSelectors: '#thisAnchorDoesNotExist',
              }),
            })).to.be.rejectedWith(InaccessibleContentError, /#thisAnchorDoesNotExist/);
          });
        });

        context('with no content for the matching given selector', () => {
          it('throws an InaccessibleContentError error', async () => {
            await expect(extractFromHTML({
              content: rawHTML,
              sourceDocument: new SourceDocument({
                location: virtualLocation,
                contentSelectors: '#empty',
              }),
            })).to.be.rejectedWith(InaccessibleContentError, /empty content/);
          });
        });

        context('with a whitespace only content for the corresponding given selector', () => {
          it('throws an InaccessibleContentError error', async () => {
            await expect(extractFromHTML({
              content: rawHTML,
              sourceDocument: new SourceDocument({
                location: virtualLocation,
                contentSelectors: '#whitespaceOnly',
              }),
            })).to.be.rejectedWith(InaccessibleContentError, /empty content/);
          });
        });

        context('with multiple selectors in one string', () => {
          it('extracts content from the given HTML', async () => {
            const result = await extractFromHTML({
              content: rawHTML,
              sourceDocument: new SourceDocument({
                location: virtualLocation,
                contentSelectors: 'h1, #link2',
              }),
            });

            expect(result).to.equal('Title\n=====\n\n[link 2](#anchor)');
          });
        });
      });

      context('with an array of selectors', () => {
        it('extracts content from the given HTML', async () => {
          const result = await extractFromHTML({
            content: rawHTML,
            sourceDocument: new SourceDocument({
              location: virtualLocation,
              contentSelectors: [ 'h1', '#link2' ],
            }),
          });

          expect(result).to.equal('Title\n=====\n\n[link 2](#anchor)');
        });

        context('when one selector is dependent on another', () => {
          it('extracts content from the given HTML', async () => {
            const result = await extractFromHTML({
              content: rawHTML,
              sourceDocument: new SourceDocument({
                location: virtualLocation,
                contentSelectors: [ 'h1', 'h1 ~ p' ],
              }),
            });

            expect(result).to.equal('Title\n=====\n\n[link 1](https://exemple.com/relative/link)\n\n[link 2](#anchor)\n\n[link 3](http://absolute.url/link)');
          });
        });
      });

      context('with range selector', () => {
        context('with startBefore and endBefore', () => {
          it('extracts content from the given HTML', async () => {
            const result = await extractFromHTML({
              content: rawHTML,
              sourceDocument: new SourceDocument({
                location: virtualLocation,
                contentSelectors: {
                  startBefore: '#link1',
                  endBefore: '#link2',
                },
              }),
            });

            expect(result).to.equal('[link 1](https://exemple.com/relative/link)');
          });
        });
        context('with startBefore and endAfter', () => {
          it('extracts content from the given HTML', async () => {
            const result = await extractFromHTML({
              content: rawHTML,
              sourceDocument: new SourceDocument({
                location: virtualLocation,
                contentSelectors: {
                  startBefore: '#link2',
                  endAfter: '#link2',
                },
              }),
            });

            expect(result).to.equal('[link 2](#anchor)');
          });
        });
        context('with startAfter and endBefore', () => {
          it('extracts content from the given HTML', async () => {
            const result = await extractFromHTML({
              content: rawHTML,
              sourceDocument: new SourceDocument({
                location: virtualLocation,
                contentSelectors: {
                  startAfter: '#link1',
                  endBefore: '#link3',
                },
              }),
            });

            expect(result).to.equal('[link 2](#anchor)');
          });
        });
        context('with startAfter and endAfter', () => {
          it('extracts content from the given HTML', async () => {
            const result = await extractFromHTML({
              content: rawHTML,
              sourceDocument: new SourceDocument({
                location: virtualLocation,
                contentSelectors: {
                  startAfter: '#link2',
                  endAfter: '#link3',
                },
              }),
            });

            expect(result).to.equal('[link 3](http://absolute.url/link)');
          });
        });
        context('with a "start" selector that has no match', () => {
          it('throws an InaccessibleContentError error', async () => {
            await expect(extractFromHTML({
              content: rawHTML,
              sourceDocument: new SourceDocument({
                location: virtualLocation,
                contentSelectors: {
                  startAfter: '#paragraph1',
                  endAfter: '#link2',
                },
              }),
            })).to.be.rejectedWith(InaccessibleContentError, /"start" selector has no match/);
          });
        });
        context('with an "end" selector that has no match', () => {
          it('throws an InaccessibleContentError error', async () => {
            await expect(extractFromHTML({
              content: rawHTML,
              sourceDocument: new SourceDocument({
                location: virtualLocation,
                contentSelectors: {
                  startAfter: '#link2',
                  endAfter: '#paragraph1',
                },
              }),
            })).to.be.rejectedWith(InaccessibleContentError, /"end" selector has no match/);
          });
        });
      });

      context('with an array of range selectors', () => {
        it('extracts content from the given HTML', async () => {
          const result = await extractFromHTML({
            content: rawHTML,
            sourceDocument: new SourceDocument({
              location: virtualLocation,
              contentSelectors: [
                {
                  startAfter: '#link1',
                  endAfter: '#link2',
                },
                {
                  startAfter: '#link2',
                  endAfter: '#link3',
                },
              ],
            }),
          });

          expect(result).to.equal('[link 2](#anchor)\n\n[link 3](http://absolute.url/link)');
        });
      });

      context('with an array of mixed string selectors and range selectors', () => {
        it('extracts content from the given HTML', async () => {
          const result = await extractFromHTML({
            content: rawHTML,
            sourceDocument: new SourceDocument({
              location: virtualLocation,
              contentSelectors: [
                'h1',
                {
                  startAfter: '#link2',
                  endAfter: '#link3',
                },
              ],
            }),
          });

          expect(result).to.equal('Title\n=====\n\n[link 3](http://absolute.url/link)');
        });
      });
    });

    describe('Remove', () => {
      context('with a simple selector', () => {
        it('removes the specified elements', async () => {
          const result = await extractFromHTML({
            content: rawHTML,
            sourceDocument: new SourceDocument({
              location: virtualLocation,
              contentSelectors: 'body',
              insignificantContentSelectors: 'h1',
            }),
          });

          expect(result).to.equal('[link 1](https://exemple.com/relative/link)\n\n[link 2](#anchor)\n\n[link 3](http://absolute.url/link)');
        });
      });

      context('with an array of string selectors', () => {
        it('removes the specified elements', async () => {
          const result = await extractFromHTML({
            content: rawHTML,
            sourceDocument: new SourceDocument({
              location: virtualLocation,
              contentSelectors: 'body',
              insignificantContentSelectors: [ 'h1', '#link3' ],
            }),
          });

          expect(result).to.equal('[link 1](https://exemple.com/relative/link)\n\n[link 2](#anchor)');
        });
      });

      context('with a simple range selector', () => {
        it('removes the specified elements', async () => {
          const result = await extractFromHTML({
            content: rawHTML,
            sourceDocument: new SourceDocument({
              location: virtualLocation,
              contentSelectors: 'body',
              insignificantContentSelectors: {
                startBefore: '#link1',
                endAfter: '#link3',
              },
            }),
          });

          expect(result).to.equal('Title\n=====');
        });
        context('with a "start" selector that has no match', () => {
          it('throws an InaccessibleContentError error', async () => {
            await expect(extractFromHTML({
              content: rawHTML,
              sourceDocument: new SourceDocument({
                location: virtualLocation,
                contentSelectors: 'body',
                insignificantContentSelectors: {
                  startAfter: '#paragraph1',
                  endAfter: '#link2',
                },
              }),
            })).to.be.rejectedWith(InaccessibleContentError, /"start" selector has no match/);
          });
        });
        context('with an "end" selector that has no match', () => {
          it('throws an InaccessibleContentError error', async () => {
            await expect(extractFromHTML({
              content: rawHTML,
              sourceDocument: new SourceDocument({
                location: virtualLocation,
                contentSelectors: 'body',
                insignificantContentSelectors: {
                  startAfter: '#link2',
                  endAfter: '#paragraph1',
                },
              }),
            })).to.be.rejectedWith(InaccessibleContentError, /"end" selector has no match/);
          });
        });
      });
      context('with an array of range selectors', () => {
        it('removes all the selections', async () => {
          const result = await extractFromHTML({
            content: rawHTML,
            sourceDocument: new SourceDocument({
              location: virtualLocation,
              contentSelectors: 'body',
              insignificantContentSelectors: [
                {
                  startBefore: 'h1',
                  endBefore: '#link1',
                },
                {
                  startBefore: '#link3',
                  endAfter: '#link3',
                },
              ],
            }),
          });

          expect(result).to.equal('[link 1](https://exemple.com/relative/link)\n\n[link 2](#anchor)');
        });
      });

      context('with an array of mixed selectors and range selectors', () => {
        it('removes all the selections', async () => {
          const result = await extractFromHTML({
            content: rawHTML,
            sourceDocument: new SourceDocument({
              location: virtualLocation,
              contentSelectors: 'body',
              insignificantContentSelectors: [
                'h1',
                {
                  startBefore: '#link3',
                  endAfter: '#link3',
                },
              ],
            }),
          });

          expect(result).to.equal('[link 1](https://exemple.com/relative/link)\n\n[link 2](#anchor)');
        });

        context('where one selector is dependent on another', () => {
          it('removes all the selections', async () => {
            const result = await extractFromHTML({
              content: rawHTML,
              sourceDocument: new SourceDocument({
                location: virtualLocation,
                contentSelectors: 'body',
                insignificantContentSelectors: [
                  'h1',
                  {
                    startAfter: 'h1',
                    endBefore: '#link2',
                  },
                ],
              }),
            });

            expect(result).to.equal('[link 2](#anchor)\n\n[link 3](http://absolute.url/link)');
          });
        });
      });
    });

    describe('Filter', () => {
      context('with a synchronous filter', () => {
        it('extracts content from the given HTML also with given additional filter', async () => {
          const result = await extractFromHTML({
            content: rawHTML,
            sourceDocument: new SourceDocument({
              location: virtualLocation,
              contentSelectors: 'body',
              filters: [additionalFilter.removeLinks],
            }),
          });

          expect(result).to.equal(expectedExtractedWithAdditional);
        });
      });

      context('with an asynchronous filter', () => {
        it('extracts content from the given HTML also with given additional filter', async () => {
          const result = await extractFromHTML({
            content: rawHTML,
            sourceDocument: new SourceDocument({
              location: virtualLocation,
              contentSelectors: 'body',
              filters: [additionalFilter.removeLinksAsync],
            }),
          });

          expect(result).to.equal(expectedExtractedWithAdditional);
        });
      });
    });
  });

  describe('#extractFromPDF', () => {
    let pdfContent;
    let expectedExtractedContent;

    before(async () => {
      pdfContent = await fs.readFile(path.resolve(__dirname, '../../../test/fixtures/terms.pdf'));
      expectedExtractedContent = await fs.readFile(
        path.resolve(__dirname, '../../../test/fixtures/termsFromPDF.md'),
        { encoding: 'utf8' },
      );
    });

    it('extracts content from the given PDF', async () => {
      expect(await extractFromPDF({ content: pdfContent })).to.equal(expectedExtractedContent);
    });
  });
});
