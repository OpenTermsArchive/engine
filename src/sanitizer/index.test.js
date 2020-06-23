import chai from 'chai';
import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

import sanitize from './index.js';

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

const expectedSanitized = `Title
=====

link 1`;

const expectedSanitizedWithAditional = `Title
=====`;

const additionalSanitizer = {
  removeLinks: function removeLinks(document) {
    const links = document.querySelectorAll('a');
    links.forEach(link => {
      link.remove();
    });
  }
}

describe('Sanitizer', () => {
  describe('#sanitize', () => {
    it('sanitizes the given HTML content', async () => {
      const result = await sanitize(rawHTML, 'body');
      expect(result).to.be.equal(expectedSanitized);
    });

    context('With an additional sanitizer', () => {
      it('sanitizes the given HTML content also with given additional sanitizers', async () => {
        const result = await sanitize(rawHTML, 'body', ['removeLinks'], additionalSanitizer);
        expect(result).to.be.equal(expectedSanitizedWithAditional);
      });
    });
  });
});
