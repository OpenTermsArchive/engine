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

    describe('with custom filters', () => {
      let receivedContext;

      const contentFilter = (dom, { select }) => {
        const element = dom.querySelector(select[0]);

        if (element) {
          element.innerHTML = 'Filtered content';
        }
      };

      const appendFilter = (dom, { select }) => {
        const element = dom.querySelector(select[0]);

        if (element) {
          element.innerHTML += ' + Appended content';
        }
      };

      const failingFilter = () => {
        throw new Error('Filter failed');
      };

      const contextSpyFilter = (dom, context) => {
        receivedContext = context;
      };

      const asyncFilter = async (dom, { select }) => {
        const element = dom.querySelector(select[0]);

        if (element) {
          await delay(100);
          element.innerHTML = 'Async content';
        }
      };

      before(() => {
        const div = webPageDOM.createElement('div');

        div.className = 'custom-content';
        webPageDOM.body.appendChild(div);

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

      describe('filter parameters', () => {
        before(async () => {
          sourceDocument.filters = [contextSpyFilter];
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
          expect(receivedContext.filter).to.deep.equal(['contextSpyFilter']);
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
    before(async () => {
      webPageDOM.body.appendChild(webPageDOM.createElement('script'));
      webPageDOM.body.appendChild(webPageDOM.createElement('style'));

      await filter(webPageDOM, sourceDocument);
    });

    it('removes script elements', () => {
      expect(webPageDOM.querySelector('script')).to.be.null;
    });

    it('removes style elements', () => {
      expect(webPageDOM.querySelector('style')).to.be.null;
    });
  });

  describe('#updateProtectedLinks', () => {
    before(async () => {
      const link = webPageDOM.createElement('a');

      link.href = 'https://example.com/email-protection';
      link.className = 'email-protection';
      link.innerHTML = 'Click here';
      webPageDOM.body.appendChild(link);

      await filter(webPageDOM, sourceDocument);
    });

    it('updates link destination', () => {
      expect(webPageDOM.querySelector('a.email-protection').href).to.equal('https://example.com/email-protection');
    });

    it('updates link content', () => {
      expect(webPageDOM.querySelector('a.email-protection').innerHTML).to.equal('[email&nbsp;protected]');
    });
  });
});
