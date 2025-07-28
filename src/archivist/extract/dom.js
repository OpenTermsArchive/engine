import jsdom from 'jsdom';

export default function createWebPageDOM(content, location) {
  const { document } = new jsdom.JSDOM(content, {
    url: location,
    virtualConsole: new jsdom.VirtualConsole(),
  }).window;

  return Object.assign(document, {
    select(contentSelectors) {
      const result = document.createDocumentFragment();

      [].concat(contentSelectors).forEach(selector => {
        if (typeof selector === 'object') {
          const rangeSelection = this.selectRange(selector);

          result.appendChild(rangeSelection.cloneContents());
        } else {
          document.querySelectorAll(selector).forEach(element => result.appendChild(element.cloneNode(true)));
        }
      });

      return result;
    },

    remove(insignificantContentSelectors) {
      const rangeSelections = [];
      const nodes = [];

      [].concat(insignificantContentSelectors).forEach(selector => {
        if (typeof selector === 'object') {
          rangeSelections.push(this.selectRange(selector));
        } else {
          nodes.push(...document.querySelectorAll(selector));
        }
      });

      nodes.forEach(node => node.remove());
      rangeSelections.forEach(rangeSelection => rangeSelection.deleteContents());

      return this;
    },

    selectRange(rangeSelector) {
      const { startBefore, startAfter, endBefore, endAfter } = rangeSelector;

      const selection = document.createRange();
      const startNode = document.querySelector(startBefore || startAfter);
      const endNode = document.querySelector(endBefore || endAfter);

      if (!startNode) {
        throw new Error(`The "start" selector has no match in document in: ${JSON.stringify(rangeSelector)}`);
      }

      if (!endNode) {
        throw new Error(`The "end" selector has no match in document in: ${JSON.stringify(rangeSelector)}`);
      }

      selection[startBefore ? 'setStartBefore' : 'setStartAfter'](startNode);
      selection[endBefore ? 'setEndBefore' : 'setEndAfter'](endNode);

      return selection;
    },
  });
}
