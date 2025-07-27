import { expect } from 'chai';

import createWebPageDOM from './dom.js';
import filter from './filter.js';

const delay = ms => new Promise(resolve => { setTimeout(resolve, ms); });

describe('Filter', () => {
  let webPageDOM;
  let sourceDocument;
  const BASE_URL = 'https://example.com';

  before(() => {
    webPageDOM = createWebPageDOM('<!DOCTYPE html><html><body></body></html>', BASE_URL);
    sourceDocument = {
      location: BASE_URL,
      contentSelectors: [],
      insignificantContentSelectors: [],
      filters: [],
      removeQueryParams: [],
    };
  });

  describe('#filter', () => {
    it('returns the webPageDOM', async () => {
      const result = await filter(webPageDOM, sourceDocument);

      expect(result).to.equal(webPageDOM);
    });

    it('removes insignificant content', async () => {
      const insignificantContent = webPageDOM.createElement('div');

      insignificantContent.className = 'insignificant';
      webPageDOM.body.appendChild(insignificantContent);
      sourceDocument.insignificantContentSelectors = ['.insignificant'];

      await filter(webPageDOM, sourceDocument);

      expect(webPageDOM.querySelector('.insignificant')).to.be.null;
    });

    describe('with custom filters', () => {
      let customElement;
      let contentFilter;
      let appendFilter;
      let failingFilter;
      let contextFilter;
      let asyncFilter;
      let receivedContext;

      before(() => {
        customElement = webPageDOM.createElement('div');
        customElement.className = 'custom-content';
        webPageDOM.body.appendChild(customElement);

        contentFilter = function contentFilter(dom, { select }) {
          const element = dom.querySelector(select[0]);

          if (element) {
            element.innerHTML = 'Filtered content';
          }
        };

        appendFilter = function appendFilter(dom, { select }) {
          const element = dom.querySelector(select[0]);

          if (element) {
            element.innerHTML += ' + Appended content';
          }
        };

        failingFilter = function failingFilter() {
          throw new Error('Filter failed');
        };

        contextFilter = function contextFilter(dom, context) {
          receivedContext = context;
        };

        asyncFilter = async function asyncFilter(dom, { select }) {
          const element = dom.querySelector(select[0]);

          if (element) {
            await delay(100);
            element.innerHTML = 'Async content';
          }
        };

        sourceDocument.contentSelectors = ['.custom-content'];
      });

      it('applies single filter to content', async () => {
        sourceDocument.filters = [contentFilter];

        await filter(webPageDOM, sourceDocument);

        expect(webPageDOM.querySelector('.custom-content').innerHTML).to.equal('Filtered content');
      });

      it('applies filters in sequence', async () => {
        sourceDocument.filters = [ contentFilter, appendFilter ];

        await filter(webPageDOM, sourceDocument);

        expect(webPageDOM.querySelector('.custom-content').innerHTML).to.equal('Filtered content + Appended content');
      });

      it('applies async filter and waits for completion', async () => {
        sourceDocument.filters = [asyncFilter];

        await filter(webPageDOM, sourceDocument);

        expect(webPageDOM.querySelector('.custom-content').innerHTML).to.equal('Async content');
      });

      it('throws error on filter failure', async () => {
        sourceDocument.filters = [failingFilter];

        await expect(filter(webPageDOM, sourceDocument)).to.be.rejectedWith('The filter function "failingFilter" failed: Error: Filter failed');
      });

      context('filter context', () => {
        before(async () => {
          sourceDocument.filters = [contextFilter];
          sourceDocument.contentSelectors = ['.custom-content'];
          sourceDocument.insignificantContentSelectors = ['.insignificant'];

          await filter(webPageDOM, sourceDocument);
        });

        it('provides content selectors', () => {
          expect(receivedContext.select).to.deep.equal(['.custom-content']);
        });

        it('provides insignificant selectors', () => {
          expect(receivedContext.remove).to.deep.equal(['.insignificant']);
        });

        it('provides location', () => {
          expect(receivedContext.fetch).to.equal(BASE_URL);
        });

        it('provides filters list', () => {
          expect(receivedContext.filter).to.deep.equal(['contextFilter']);
        });
      });
    });
  });

  describe('#convertRelativeURLsToAbsolute', () => {
    let link;

    before(() => {
      link = webPageDOM.createElement('a');
      webPageDOM.body.appendChild(link);
    });

    it('converts relative URLs to absolute', async () => {
      link.href = '/path/to/page';
      await filter(webPageDOM, sourceDocument);

      expect(link.href).to.equal('https://example.com/path/to/page');
    });

    it('keeps invalid URLs unchanged', async () => {
      link.href = 'invalid://url';
      await filter(webPageDOM, sourceDocument);

      expect(link.href).to.equal('invalid://url');
    });
  });

  describe('#removeUnwantedElements', () => {
    let script;
    let style;

    before(async () => {
      script = webPageDOM.createElement('script');
      style = webPageDOM.createElement('style');
      webPageDOM.body.appendChild(script);
      webPageDOM.body.appendChild(style);
      await filter(webPageDOM, sourceDocument);
    });

    it('removes script elements', async () => {
      expect(webPageDOM.querySelector('script')).to.be.null;
    });

    it('removes style elements', async () => {
      expect(webPageDOM.querySelector('style')).to.be.null;
    });
  });

  describe('#updateProtectedLinks', () => {
    let link;

    before(async () => {
      link = webPageDOM.createElement('a');
      link.href = 'https://example.com/email-protection';
      link.className = 'email-protection';
      link.innerHTML = 'Click here';
      webPageDOM.body.appendChild(link);
      await filter(webPageDOM, sourceDocument);
    });

    it('updates link href', async () => {
      expect(webPageDOM.querySelector('a.email-protection').href).to.equal('https://example.com/email-protection');
    });

    it('updates link content', async () => {
      expect(webPageDOM.querySelector('a.email-protection').innerHTML).to.equal('[email&nbsp;protected]');
    });
  });
});
