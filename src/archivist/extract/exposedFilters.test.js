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
        link.setAttribute('href', 'https://example.com/page?utm_source=test&keep=value');
        webPageDOM.body.appendChild(link);
      });

      after(() => {
        link.remove();
      });

      it('removes the specified query parameters', () => {
        removeQueryParams(webPageDOM, ['utm_source']);

        expect(link.getAttribute('href')).to.equal('https://example.com/page?keep=value');
      });
    });

    describe('from images', () => {
      let img;

      before(() => {
        img = webPageDOM.createElement('img');
        img.setAttribute('src', 'https://example.com/image.jpg?width=100&keep=value');
        webPageDOM.body.appendChild(img);
      });

      after(() => {
        img.remove();
      });

      it('removes the specified query parameters', () => {
        removeQueryParams(webPageDOM, ['width']);

        expect(img.getAttribute('src')).to.equal('https://example.com/image.jpg?keep=value');
      });
    });

    describe('with string parameter', () => {
      let link;

      before(() => {
        link = webPageDOM.createElement('a');
        link.setAttribute('href', 'https://example.com/page?utm_source=test&keep=value');
        webPageDOM.body.appendChild(link);
      });

      after(() => {
        link.remove();
      });

      it('removes a single query parameter passed as string', () => {
        removeQueryParams(webPageDOM, 'utm_source');

        expect(link.getAttribute('href')).to.equal('https://example.com/page?keep=value');
      });
    });

    describe('with empty parameters', () => {
      let link;

      before(() => {
        link = webPageDOM.createElement('a');
        link.setAttribute('href', 'https://example.com/page?utm_source=test&keep=value');
        webPageDOM.body.appendChild(link);
      });

      after(() => {
        link.remove();
      });

      it('leaves the URL unchanged', () => {
        removeQueryParams(webPageDOM, []);

        expect(link.getAttribute('href')).to.equal('https://example.com/page?utm_source=test&keep=value');
      });
    });

    describe('with invalid URLs', () => {
      let link;
      let webPageDOMWithBaseURL;
      const invalidURL = 'ht^THIS_IS_WRONG^tp://example.com?utm_source=test';

      before(() => {
        webPageDOMWithBaseURL = createWebPageDOM('<!DOCTYPE html><html><body></body></html>');
      });

      before(() => {
        link = webPageDOMWithBaseURL.createElement('a');
        link.setAttribute('href', invalidURL);
        webPageDOMWithBaseURL.body.appendChild(link);
      });

      after(() => {
        link.remove();
      });

      it('ignores elements with invalid URLs', () => {
        removeQueryParams(webPageDOMWithBaseURL, ['utm_source']);

        expect(link.getAttribute('href')).to.equal(invalidURL);
      });
    });

    describe('with multiple parameters', () => {
      let link;

      before(() => {
        link = webPageDOM.createElement('a');
        link.setAttribute('href', 'https://example.com/page?utm_source=test&utm_medium=email&keep=value&remove=me');
        webPageDOM.body.appendChild(link);
      });

      after(() => {
        link.remove();
      });

      it('removes all specified query parameters', () => {
        removeQueryParams(webPageDOM, [ 'utm_source', 'utm_medium', 'remove' ]);

        expect(link.getAttribute('href')).to.equal('https://example.com/page?keep=value');
      });
    });

    describe('with duplicate parameters', () => {
      let link;

      before(() => {
        link = webPageDOM.createElement('a');
        link.setAttribute('href', 'https://example.com/test?utm_source=to_remove_1&keep=true&utm_source=to_remove_2');
        webPageDOM.body.appendChild(link);
      });

      after(() => {
        link.remove();
      });

      it('removes all instances of duplicate query parameters', () => {
        removeQueryParams(webPageDOM, ['utm_source']);

        expect(link.getAttribute('href')).to.equal('https://example.com/test?keep=true');
      });
    });

    describe('with URLs without target parameters', () => {
      let absoluteLink;
      let relativeLink;
      let anchorLink;
      let img;
      const originalAbsoluteHref = 'https://example.com/page?keep=value&preserve=me';
      const originalRelativeHref = './relative/path?existing=param';
      const originalAnchorHref = '#section1';
      const originalImgSrc = 'https://example.com/image.jpg?width=100&height=200';

      before(() => {
        absoluteLink = webPageDOM.createElement('a');
        absoluteLink.setAttribute('href', originalAbsoluteHref);
        webPageDOM.body.appendChild(absoluteLink);

        relativeLink = webPageDOM.createElement('a');
        relativeLink.setAttribute('href', originalRelativeHref);
        webPageDOM.body.appendChild(relativeLink);

        anchorLink = webPageDOM.createElement('a');
        anchorLink.setAttribute('href', originalAnchorHref);
        webPageDOM.body.appendChild(anchorLink);

        img = webPageDOM.createElement('img');
        img.setAttribute('src', originalImgSrc);
        webPageDOM.body.appendChild(img);

        removeQueryParams(webPageDOM, [ 'utm_source', 'utm_medium', 'session_id' ]);
      });

      after(() => {
        absoluteLink.remove();
        relativeLink.remove();
        anchorLink.remove();
        img.remove();
      });

      it('leaves absolute link URLs untouched', () => {
        expect(absoluteLink.getAttribute('href')).to.equal(originalAbsoluteHref);
      });

      it('leaves relative link URLs untouched', () => {
        expect(relativeLink.getAttribute('href')).to.equal(originalRelativeHref);
      });

      it('leaves anchor link URLs untouched', () => {
        expect(anchorLink.getAttribute('href')).to.equal(originalAnchorHref);
      });

      it('leaves image source URLs untouched', () => {
        expect(img.getAttribute('src')).to.equal(originalImgSrc);
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

      after(() => {
        codeElement.remove();
        paragraphElement.remove();
        preElement.remove();
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
