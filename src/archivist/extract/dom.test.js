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
            <p class="intro">Introduction paragraph</p>
            <p class="body">Body paragraph</p>
            <p class="outro">Conclusion paragraph</p>
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
      const fragment = document.select('p.intro');
      const paragraph = fragment.querySelector('p');

      expect(paragraph.textContent).to.equal('Introduction paragraph');
    });

    it('returns multiple elements using CSS selectors', () => {
      const fragment = document.select('p');
      const paragraphs = fragment.querySelectorAll('p');

      expect(paragraphs.length).to.equal(4);
    });

    it('returns elements using an array of CSS selectors', () => {
      const fragment = document.select([ 'h1', '.intro' ]);
      const heading = fragment.querySelector('h1');
      const paragraph = fragment.querySelector('p');

      expect(heading.textContent).to.equal('Main Title');
      expect(paragraph.textContent).to.equal('Introduction paragraph');
    });

    it('returns content using a range selector object', () => {
      const rangeSelector = {
        startAfter: '.intro',
        endBefore: '.outro',
      };
      const fragment = document.select(rangeSelector);
      const paragraph = fragment.querySelector('p');

      expect(paragraph.textContent).to.equal('Body paragraph');
    });

    it('returns an empty fragment when the selector matches no element', () => {
      const fragment = document.select('.nonexistent');

      expect(fragment.childNodes.length).to.equal(0);
    });
  });

  describe('#remove', () => {
    let testDocument;

    before(() => {
      testDocument = createWebPageDOM(sampleHTML, location);
    });

    it('removes elements using CSS selectors', () => {
      testDocument.remove('.sidebar');
      const sidebar = testDocument.querySelector('.sidebar');

      expect(sidebar).to.be.null;
    });

    it('removes multiple elements using CSS selectors', () => {
      const freshDocument = createWebPageDOM(sampleHTML, location);

      freshDocument.remove('p');
      const paragraphs = freshDocument.querySelectorAll('p');

      expect(paragraphs.length).to.equal(0);
    });

    it('removes elements using an array of CSS selectors', () => {
      const freshDocument = createWebPageDOM(sampleHTML, location);

      freshDocument.remove([ 'nav', '.widget' ]);
      const nav = freshDocument.querySelector('nav');
      const widget = freshDocument.querySelector('.widget');

      expect(nav).to.be.null;
      expect(widget).to.be.null;
    });

    it('removes content using a range selector object', () => {
      const freshDocument = createWebPageDOM(sampleHTML, location);
      const rangeSelector = {
        startAfter: '.intro',
        endBefore: '.outro',
      };

      freshDocument.remove(rangeSelector);
      const bodyParagraph = freshDocument.querySelector('.body');

      expect(bodyParagraph).to.be.null;
    });
  });

  describe('#selectRange', () => {
    it('creates a range using startAfter and endBefore', () => {
      const rangeSelector = {
        startAfter: '.intro',
        endBefore: '.outro',
      };
      const range = document.selectRange(rangeSelector);
      const fragment = range.cloneContents();
      const paragraph = fragment.querySelector('p');

      expect(paragraph.textContent).to.equal('Body paragraph');
    });

    it('creates a range using startBefore and endAfter', () => {
      const rangeSelector = {
        startBefore: '.body',
        endAfter: '.body',
      };
      const range = document.selectRange(rangeSelector);
      const fragment = range.cloneContents();
      const paragraph = fragment.querySelector('p');

      expect(paragraph.textContent).to.equal('Body paragraph');
    });
    it('throws an error when the start selector has no match', () => {

      const rangeSelector = {
        startAfter: '.nonexistent',
        endBefore: '.outro',
      };

      expect(() => document.selectRange(rangeSelector)).to.throw('The "start" selector has no match in document');
    });

    it('throws an error when the end selector has no match', () => {
      const rangeSelector = {
        startAfter: '.intro',
        endBefore: '.nonexistent',
      };

      expect(() => document.selectRange(rangeSelector)).to.throw('The "end" selector has no match in document');
    });

    it('includes the selector in the error message when the start selector fails', () => {
      const rangeSelector = {
        startAfter: '.missing',
        endBefore: '.outro',
      };

      expect(() => document.selectRange(rangeSelector)).to.throw(JSON.stringify(rangeSelector));
    });

    it('includes the selector in the error message when the end selector fails', () => {
      const rangeSelector = {
        startAfter: '.intro',
        endBefore: '.missing',
      };

      expect(() => document.selectRange(rangeSelector)).to.throw(JSON.stringify(rangeSelector));
    });
  });
});
