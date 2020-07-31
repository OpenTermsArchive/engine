import chai from 'chai';
import jsdom from 'jsdom';

import filter, { convertRelativeURLsToAbsolute } from './index.js';

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

  describe('#filter', () => {
    it('filters the given HTML content', async () => {
      const result = await filter(rawHTML, 'body', virtualLocation);
      expect(result).to.equal(expectedFiltered);
    });

    context('With no match for the given selector', () => {
      it('throws an error', async () => {
        try {
          await filter(rawHTML, '#thisAnchorDoesNotExist', virtualLocation);
        } catch (e) {
          expect(e).to.be.an('error');
          expect(e.message).to.have.string('provided selector', 'has no match');
          return;
        }
        expect.fail('No error was thrown');
      });
    });

    context('With an additional filter', () => {
      it('filters the given HTML content also with given additional filter', async () => {
        const result = await filter(rawHTML, 'body', virtualLocation, ['removeLinks'], additionalFilter);
        expect(result).to.equal(expectedFilteredWithAdditional);
      });
    });

    context('With multiple selectors', () => {
      it('filters the given HTML content', async () => {
        const result = await filter(rawHTML, 'h1, #link2', virtualLocation);
        expect(result).to.equal('Title\nlink 2');
      });
    });

    context('With range selector', () => {
      context('With startBefore and endBefore', () => {
        it('filters the given HTML content', async () => {
          const result = await filter(rawHTML, {
            startBefore: '#link1',
            endBefore: '#link2'
          }, virtualLocation);
          expect(result).to.equal('[link 1](https://exemple.com/relative/link)');
        });
      });
      context('With startBefore and endAfter', () => {
        it('filters the given HTML content', async () => {
          const result = await filter(rawHTML, {
            startBefore: '#link2',
            endAfter: '#link2'
          }, virtualLocation);
          expect(result).to.equal('[link 2](#anchor)');
        });
      });
      context('With startAfter and endBefore', () => {
        it('filters the given HTML content', async () => {
          const result = await filter(rawHTML, {
            startAfter: '#link1',
            endBefore: '#link3'
          }, virtualLocation);
          expect(result).to.equal('[link 2](#anchor)');
        });
      });
      context('With startAfter and endAfter', () => {
        it('filters the given HTML content', async () => {
          const result = await filter(rawHTML, {
            startAfter: '#link2',
            endAfter: '#link3'
          }, virtualLocation);
          expect(result).to.equal('[link 3](http://absolute.url/link)');
        });
      });
    });
  });
});
