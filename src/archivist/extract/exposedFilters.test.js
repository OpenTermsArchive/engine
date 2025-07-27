import { expect } from 'chai';

import createWebPageDOM from './dom.js';
import { removeQueryParams } from './exposedFilters.js';

describe('exposedFilters', () => {
  let webPageDOM;

  before(() => {
    webPageDOM = createWebPageDOM('<!DOCTYPE html><html><body></body></html>', 'https://example.com');
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

      it('leaves URL unchanged when no parameters to remove', () => {
        removeQueryParams(webPageDOM, []);

        expect(link.href).to.equal('https://example.com/page?utm_source=test&keep=value');
      });
    });

    describe('with invalid URLs', () => {
      let link;

      before(() => {
        link = webPageDOM.createElement('a');
        link.href = 'invalid://url';
        webPageDOM.body.appendChild(link);
      });

      it('ignores elements with invalid URLs', () => {
        removeQueryParams(webPageDOM, ['utm_source']);

        expect(link.href).to.equal('invalid://url');
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
  });
});
