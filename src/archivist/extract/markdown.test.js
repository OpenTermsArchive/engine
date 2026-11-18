import { expect } from 'chai';

import createWebPageDOM from './dom.js';
import { transformFromHTML } from './markdown.js';

const LINK = 'https://example.com/terms';

function transform(html) {
  const webPageDOM = createWebPageDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, 'https://example.com');

  return transformFromHTML(webPageDOM.select('body'));
}

describe('Markdown', () => {
  describe('#transformFromHTML', () => {
    describe('Markup variations that render the same', () => {
      context('with bold applied around or inside a link', () => {
        it('results in bold applied inside the link', () => {
          expect(transform(`<p><strong><a href="${LINK}">terms</a></strong></p>`)).to.equal(`[**terms**](${LINK})`);
          expect(transform(`<p><a href="${LINK}"><strong>terms</strong></a></p>`)).to.equal(`[**terms**](${LINK})`);
        });
      });

      context('with italic applied around or inside a link', () => {
        it('results in italic applied inside the link', () => {
          expect(transform(`<p><em><a href="${LINK}">terms</a></em></p>`)).to.equal(`[_terms_](${LINK})`);
          expect(transform(`<p><a href="${LINK}"><i>terms</i></a></p>`)).to.equal(`[_terms_](${LINK})`);
        });
      });

      context('with bold applied around or inside italic', () => {
        it('results in bold applied around italic', () => {
          expect(transform('<p><strong><em>terms</em></strong></p>')).to.equal('**_terms_**');
          expect(transform('<p><em><strong>terms</strong></em></p>')).to.equal('**_terms_**');
        });
      });

      context('with bold, italic and a link nested in any order', () => {
        it('results in the link applied around bold applied around italic', () => {
          expect(transform(`<p><a href="${LINK}"><em><strong>terms</strong></em></a></p>`)).to.equal(`[**_terms_**](${LINK})`);
          expect(transform(`<p><em><a href="${LINK}"><strong>terms</strong></a></em></p>`)).to.equal(`[**_terms_**](${LINK})`);
          expect(transform(`<p><strong><em><a href="${LINK}">terms</a></em></strong></p>`)).to.equal(`[**_terms_**](${LINK})`);
        });
      });

      context('with bold applied several times to the same content', () => {
        it('applies bold only once', () => {
          expect(transform('<p><strong><b>terms</b></strong></p>')).to.equal('**terms**');
          expect(transform(`<p><strong><a href="${LINK}"><b>terms</b></a></strong></p>`)).to.equal(`[**terms**](${LINK})`);
        });
      });

      context('with bold applied to a part of content already in bold', () => {
        it('applies bold only once', () => {
          expect(transform('<p>The <strong>terms <b>of use</b></strong></p>')).to.equal('The **terms of use**');
          expect(transform(`<p><strong><a href="${LINK}"><b>terms</b> of use</a></strong></p>`)).to.equal(`[**terms of use**](${LINK})`);
        });
      });

      context('with italic applied to a part of content already in italic', () => {
        it('applies italic only once', () => {
          expect(transform('<p>The <em><i>terms</i> <strong>of <i>use</i></strong></em></p>')).to.equal('The _terms **of use**_');
        });
      });

      context('with whitespace around a link in bold', () => {
        it('results in bold applied inside the link', () => {
          expect(transform(`<p>See <strong> <a href="${LINK}">terms</a> </strong> now</p>`)).to.equal(`See [**terms**](${LINK}) now`);
        });
      });

      context('with consecutive links in bold', () => {
        it('results in bold applied inside each link', () => {
          expect(transform(`<p><strong><a href="${LINK}">terms</a></strong><strong><a href="${LINK}">policy</a></strong></p>`)).to.equal(`[**terms**](${LINK})[**policy**](${LINK})`);
        });
      });

      context('with bold applied around or inside a link that contains a block element', () => {
        it('results in bold applied inside the link', () => {
          expect(transform(`<div><strong><a href="${LINK}"><div>terms</div></a></strong></div>`)).to.equal(`[**terms**](${LINK})`);
          expect(transform(`<div><a href="${LINK}"><strong><div>terms</div></strong></a></div>`)).to.equal(`[**terms**](${LINK})`);
        });
      });

      context('with italic applied around or inside a link that contains a block element', () => {
        it('results in italic applied inside the link', () => {
          expect(transform(`<div><em><a href="${LINK}"><p>terms</p></a></em></div>`)).to.equal(`[_terms_](${LINK})`);
          expect(transform(`<div><a href="${LINK}"><em><p>terms</p></em></a></div>`)).to.equal(`[_terms_](${LINK})`);
        });
      });

      context('with bold applied around a block element', () => {
        it('applies bold to the content of the block', () => {
          expect(transform('<div><strong><div>terms</div></strong></div>')).to.equal('**terms**');
        });
      });

      context('with a line break at the end of the content in bold', () => {
        it('applies bold before the line break', () => {
          expect(transform('<p><strong>Terms<br></strong>apply</p>')).to.equal('**Terms**  \napply');
        });
      });

      context('with a line break at the start of the content in italic', () => {
        it('applies italic after the line break', () => {
          expect(transform('<p>The<em><br>terms</em></p>')).to.equal('The  \n_terms_');
        });
      });

      context('with bold applied to a part of a link only', () => {
        it('leaves bold where it is', () => {
          expect(transform(`<p><a href="${LINK}"><strong>the</strong> terms</a></p>`)).to.equal(`[**the** terms](${LINK})`);
        });
      });

      context('with bold applied to a link and its surrounding text', () => {
        it('leaves bold where it is', () => {
          expect(transform(`<p><strong>see the <a href="${LINK}">terms</a></strong></p>`)).to.equal(`**see the [terms](${LINK})**`);
        });
      });

      context('with text wrapped in an element that has no Markdown equivalent', () => {
        it('results in the same Markdown as without the wrapper', () => {
          const expected = 'and embed >x< content, see section 1. Scope';

          expect(transform('<p>and embed &gt;x&lt; content, see section 1. Scope</p>')).to.equal(expected);
          expect(transform('<p>and embed <span>&gt;x&lt;</span> content, see section <span>1. Scope</span></p>')).to.equal(expected);
          expect(transform('<p>and embed <font color="red">&gt;x&lt;</font> content, see section <span><span>1. Scope</span></span></p>')).to.equal(expected);
        });
      });

      context('with text split by comments', () => {
        it('results in the same Markdown as without the comments', () => {
          expect(transform('<p>and embed <!-- -->&gt;x&lt;<!-- --> content</p>')).to.equal('and embed >x< content');
        });
      });
    });
  });
});
