import chai from 'chai';

import filter from './index.js';

const expect = chai.expect;

const rawHTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>TOS</title>
  </head>
  <body>
    <h1>Title</h1>
    <a href="">link 1</a>
  </body>
</html>`;

const expectedFiltered = `Title
=====

link 1`;

const expectedFilteredWithAditional = `Title
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
  describe('#filter', () => {
    it('filters the given HTML content', async () => {
      const result = await filter(rawHTML, 'body');
      expect(result).to.be.equal(expectedFiltered);
    });

    context('With an additional filter', () => {
      it('filters the given HTML content also with given additional filter', async () => {
        const result = await filter(rawHTML, 'body', ['removeLinks'], additionalFilter);
        expect(result).to.be.equal(expectedFilteredWithAditional);
      });
    });
  });
});
