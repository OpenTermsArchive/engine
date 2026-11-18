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
      context('with bold applied inside a link that contains a block element', () => {
        it('results in bold applied inside the link', () => {
          expect(transform(`<div><a href="${LINK}"><strong><div>terms</div></strong></a></div>`)).to.equal(`[**terms**](${LINK})`);
        });
      });

      context('with italic applied inside a link that contains a block element', () => {
        it('results in italic applied inside the link', () => {
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
    });
  });
});
