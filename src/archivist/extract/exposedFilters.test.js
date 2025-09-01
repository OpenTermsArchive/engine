import { expect } from 'chai';

import createWebPageDOM from './dom.js';
import { removeQueryParams } from './exposedFilters.js';

describe('exposedFilters', () => {
  let webPageDOM;

  before(() => {
    webPageDOM = createWebPageDOM('<!DOCTYPE html><html><body></body></html>');
  });

  describe('#removeQueryParams', () => {
    describe('from links', () => {
      let link;

      before(() => {
        link = webPageDOM.createElement('a');
        link.href = 'https://example.com/page?utm_source=test&keep=value';
        webPageDOM.body.appendChild(link);
      });

      it('removes the specified query parameters', () => {
        removeQueryParams(webPageDOM, ['utm_source']);

        expect(link.href).to.equal('https://example.com/page?keep=value');
      });
    });

    describe('from images', () => {
      let img;

      before(() => {
        img = webPageDOM.createElement('img');
        img.src = 'https://example.com/image.jpg?width=100&keep=value';
        webPageDOM.body.appendChild(img);
      });

      it('removes the specified query parameters', () => {
        removeQueryParams(webPageDOM, ['width']);

        expect(img.src).to.equal('https://example.com/image.jpg?keep=value');
      });
    });

    describe('with string parameter', () => {
      let link;

      before(() => {
        link = webPageDOM.createElement('a');
        link.href = 'https://example.com/page?utm_source=test&keep=value';
        webPageDOM.body.appendChild(link);
      });

      it('removes a single query parameter passed as string', () => {
        removeQueryParams(webPageDOM, 'utm_source');

        expect(link.href).to.equal('https://example.com/page?keep=value');
      });
    });

    describe('with empty parameters', () => {
      let link;

      before(() => {
        link = webPageDOM.createElement('a');
        link.href = 'https://example.com/page?utm_source=test&keep=value';
        webPageDOM.body.appendChild(link);
      });

      it('leaves the URL unchanged', () => {
        removeQueryParams(webPageDOM, []);

        expect(link.href).to.equal('https://example.com/page?utm_source=test&keep=value');
      });
    });

    describe('with invalid URLs', () => {
      let link;

      before(() => {
        link = webPageDOM.createElement('a');
        link.href = 'ht^tp://example.com?utm_source=test';
        webPageDOM.body.appendChild(link);
      });

      it('ignores elements with invalid URLs', () => {
        removeQueryParams(webPageDOM, ['utm_source']);

        expect(link.href).to.equal('ht^tp://example.com?utm_source=test');
      });
    });

    describe('with multiple parameters', () => {
      let link;

      before(() => {
        link = webPageDOM.createElement('a');
        link.href = 'https://example.com/page?utm_source=test&utm_medium=email&keep=value&remove=me';
        webPageDOM.body.appendChild(link);
      });

      it('removes all specified query parameters', () => {
        removeQueryParams(webPageDOM, [ 'utm_source', 'utm_medium', 'remove' ]);

        expect(link.href).to.equal('https://example.com/page?keep=value');
      });
    });

    describe('with duplicate parameters', () => {
      let link;

      before(() => {
        link = webPageDOM.createElement('a');
        link.href = 'https://example.com/test?utm_source=to_remove_1&keep=true&utm_source=to_remove_2';
        webPageDOM.body.appendChild(link);
      });

      it('removes all instances of duplicate query parameters', () => {
        removeQueryParams(webPageDOM, ['utm_source']);

        expect(link.href).to.equal('https://example.com/test?keep=true');
      });
    });

    describe('textual content preservation', () => {
      let codeElement;
      let paragraphElement;
      let preElement;

      before(() => {
        codeElement = webPageDOM.createElement('code');
        codeElement.textContent = 'https://example.com/track?utm_source=newsletter&utm_campaign=winter';
        webPageDOM.body.appendChild(codeElement);

        paragraphElement = webPageDOM.createElement('p');
        paragraphElement.textContent = 'When users click on links with utm_source=email or utm_medium=social, we track their behavior using https://analytics.example.com?utm_source=website&session_id=abc123.';
        webPageDOM.body.appendChild(paragraphElement);

        preElement = webPageDOM.createElement('pre');
        preElement.textContent = `
// Example tracking implementation
const trackingUrl = 'https://tracker.com/pixel?utm_source=app&user_id=123';
fetch(trackingUrl);
        `;
        webPageDOM.body.appendChild(preElement);
      });

      it('preserves code element URLs with tracking parameters', () => {
        const originalCodeContent = codeElement.textContent;

        removeQueryParams(webPageDOM, [ 'utm_source', 'utm_campaign', 'utm_medium', 'session_id', 'user_id' ]);

        expect(codeElement.textContent).to.equal(originalCodeContent);
      });

      it('preserves paragraph element URLs with tracking parameters', () => {
        const originalParagraphContent = paragraphElement.textContent;

        removeQueryParams(webPageDOM, [ 'utm_source', 'utm_campaign', 'utm_medium', 'session_id', 'user_id' ]);

        expect(paragraphElement.textContent).to.equal(originalParagraphContent);
      });

      it('preserves preformatted element URLs with tracking parameters', () => {
        const originalPreContent = preElement.textContent;

        removeQueryParams(webPageDOM, [ 'utm_source', 'utm_campaign', 'utm_medium', 'session_id', 'user_id' ]);

        expect(preElement.textContent).to.equal(originalPreContent);
      });
    });
  });
});
