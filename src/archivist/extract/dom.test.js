import { expect } from 'chai';

import createWebPageDOM from './dom.js';

describe('createWebPageDOM', () => {
  const sampleHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Document</title>
      </head>
      <body>
        <header id="header">
          <h1>Main Title</h1>
          <nav class="navigation">
            <a href="/home">Home</a>
            <a href="/about">About</a>
          </nav>
        </header>
        <main>
          <article id="content">
            <p class="introduction">Introduction paragraph</p>
            <p class="central">Central paragraph</p>
            <p class="conclusion">Conclusion paragraph</p>
          </article>
          <aside class="sidebar">
            <div class="widget">Widget content</div>
          </aside>
        </main>
        <footer id="footer">
          <p>Footer content</p>
        </footer>
      </body>
    </html>
  `;
  const location = 'https://example.com/test';
  let document;

  before(() => {
    document = createWebPageDOM(sampleHTML, location);
  });

  it('creates a DOM document from HTML content', () => {
    expect(document.documentElement.tagName).to.equal('HTML');
  });

  it('sets the document location', () => {
    expect(document.location.href).to.equal(location);
  });

  it('provides access to the DOM API', () => {
    const title = document.querySelector('title');

    expect(title.textContent).to.equal('Test Document');
  });

  describe('#select', () => {
    it('returns elements using CSS selectors', () => {
      const fragment = document.select('p.introduction');
      const paragraph = fragment.querySelector('p');

      expect(paragraph.textContent).to.equal('Introduction paragraph');
    });

    it('returns multiple elements using CSS selectors', () => {
      const fragment = document.select('p');
      const paragraphs = fragment.querySelectorAll('p');

      expect(paragraphs.length).to.equal(4);
    });

    it('returns elements using an array of CSS selectors', () => {
      const fragment = document.select([ 'h1', '.introduction' ]);
      const heading = fragment.querySelector('h1');
      const paragraph = fragment.querySelector('p');

      expect(heading.textContent).to.equal('Main Title');
      expect(paragraph.textContent).to.equal('Introduction paragraph');
    });

    it('returns content using a range selector object', () => {
      const rangeSelector = {
        startAfter: '.introduction',
        endBefore: '.conclusion',
      };
      const fragment = document.select(rangeSelector);
      const paragraph = fragment.querySelector('p');

      expect(paragraph.textContent).to.equal('Central paragraph');
    });

    it('returns null when the selector matches no element', () => {
      const result = document.select('.nonexistent');

      expect(result).to.be.null;
    });
  });

  describe('#remove', () => {
    let testDocument;

    beforeEach(() => {
      testDocument = createWebPageDOM(sampleHTML, location);
    });

    it('removes elements using CSS selectors', () => {
      testDocument.remove('.sidebar');
      const sidebar = testDocument.querySelector('.sidebar');

      expect(sidebar).to.be.null;
    });

    it('removes multiple elements using CSS selectors', () => {
      testDocument.remove('p');
      const paragraphs = testDocument.querySelectorAll('p');

      expect(paragraphs.length).to.equal(0);
    });

    it('removes elements using an array of CSS selectors', () => {
      testDocument.remove([ 'nav', '.widget' ]);
      const nav = testDocument.querySelector('nav');
      const widget = testDocument.querySelector('.widget');

      expect(nav).to.be.null;
      expect(widget).to.be.null;
    });

    it('removes content using a range selector object', () => {
      const rangeSelector = {
        startAfter: '.introduction',
        endBefore: '.conclusion',
      };

      testDocument.remove(rangeSelector);
      const bodyParagraph = testDocument.querySelector('.central');

      expect(bodyParagraph).to.be.null;
    });
  });

  describe('#selectRange', () => {
    it('creates a range using startAfter and endBefore', () => {
      const rangeSelector = {
        startAfter: '.introduction',
        endBefore: '.conclusion',
      };
      const range = document.selectRange(rangeSelector);
      const fragment = range.cloneContents();
      const paragraph = fragment.querySelector('p');

      expect(paragraph.textContent).to.equal('Central paragraph');
    });

    it('creates a range using startBefore and endAfter', () => {
      const rangeSelector = {
        startBefore: '.central',
        endAfter: '.central',
      };
      const range = document.selectRange(rangeSelector);
      const fragment = range.cloneContents();
      const paragraph = fragment.querySelector('p');

      expect(paragraph.textContent).to.equal('Central paragraph');
    });

    it('throws a clear error when the startBefore selector has no match', () => {
      const rangeSelector = {
        startBefore: '.nonexistent',
        endBefore: '.conclusion',
      };

      expect(() => document.selectRange(rangeSelector)).to.throw('"start" selector has no match');
      expect(() => document.selectRange(rangeSelector)).to.throw(JSON.stringify(rangeSelector));
    });

    it('throws a clear error when the startAfter selector has no match', () => {
      const rangeSelector = {
        startAfter: '.nonexistent',
        endBefore: '.conclusion',
      };

      expect(() => document.selectRange(rangeSelector)).to.throw('"start" selector has no match');
      expect(() => document.selectRange(rangeSelector)).to.throw(JSON.stringify(rangeSelector));
    });

    it('throws a clear error when the endBefore selector has no match', () => {
      const rangeSelector = {
        startAfter: '.introduction',
        endBefore: '.nonexistent',
      };

      expect(() => document.selectRange(rangeSelector)).to.throw('"end" selector has no match');
      expect(() => document.selectRange(rangeSelector)).to.throw(JSON.stringify(rangeSelector));
    });

    it('throws a clear error when the endAfter selector has no match', () => {
      const rangeSelector = {
        startAfter: '.introduction',
        endAfter: '.nonexistent',
      };

      expect(() => document.selectRange(rangeSelector)).to.throw('"end" selector has no match');
      expect(() => document.selectRange(rangeSelector)).to.throw(JSON.stringify(rangeSelector));
    });
  });
});
