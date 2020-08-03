import chai from 'chai';
import jsdom from 'jsdom';

import filter, { convertRelativeURLsToAbsolute } from './index.js';

const { JSDOM } = jsdom;
const expect = chai.expect;

const virtualLocation = "https://exemple.com/main";
const rawHTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>TOS</title>
  </head>
  <body>
    <h1>Title</h1>
    <p><a href="/relative/link">link 1</a></p>
    <p><a id="link2" href="#anchor">link 2</a></p>
    <p><a href="http://absolute.url/link">link 3</a></p>
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
}

describe('Filter', () => {
  describe('#convertRelativeURLsToAbsolute', () => {
    let subject;
    before(() => {
      let { document: webPageDOM } = new JSDOM(rawHTML).window;
      convertRelativeURLsToAbsolute(webPageDOM, virtualLocation);
      subject = Array.from(webPageDOM.querySelectorAll('a[href]')).map(el => el.href);
    })

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
      it('returns an empty string', async () => {
        const result = await filter(rawHTML, '#thisAnchorDoesNotExist', virtualLocation);
        expect(result).to.equal('');
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
        expect(result).to.equal(`Title
link 2`);
      });
    });
  });
});
