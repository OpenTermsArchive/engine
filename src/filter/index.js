import url from 'url';

import TurndownService from 'turndown';
import turndownPluginGithubFlavouredMarkdown from 'joplin-turndown-plugin-gfm';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();
turndownService.use(turndownPluginGithubFlavouredMarkdown.gfm);

export const LINKS_TO_CONVERT_SELECTOR = 'a[href]:not([href^="#"])';

export default async function filter(content, location, selector, removeElements, filterNames, filterFunctions) {
  const { document: webPageDOM } = new JSDOM(content).window;

  if (filterNames) {
    filterNames.forEach(filterName => {
      // Filters work in place
      filterFunctions[filterName](webPageDOM);
    });
  }

  convertRelativeURLsToAbsolute(webPageDOM, location);

  const selectedContent = webPageDOM;

  if (removeElements) {
    [].concat(removeElements).forEach(elementSelector => {
      if (typeof elementSelector === 'object') {
        const rangeSelection = getRangeSelection(selectedContent, elementSelector);
        rangeSelection.deleteContents();
      } else {
        Array.from(webPageDOM.querySelectorAll(elementSelector)).forEach(node => node.remove());
      }
    });
  }

  const selectedContents = [];
  if (selector) {
    [].concat(selector).forEach(elementSelector => {
      if (typeof elementSelector === 'object') {
        const rangeSelection = getRangeSelection(selectedContent, elementSelector);
        selectedContents.push(rangeSelection.cloneContents());
      } else {
        selectedContents.push(...Array.from(webPageDOM.querySelectorAll(elementSelector)));
      }
    });
  }

  if (!selectedContents.length) {
    throw new Error(`The provided selector "${selector}" has no match in the web page.`);
  }

  return selectedContents.map(domFragment => turndownService.turndown(domFragment)).join('\n');
}

function getRangeSelection(document, rangeSelector) {
  const { startBefore, startAfter, endBefore, endAfter } = rangeSelector;

  if (startBefore && startAfter) {
    throw new Error(`Content selectors "startBefore" and "startAfter" cannot both be defined. Specify only one in: ${JSON.stringify(rangeSelector)}`);
  }

  if (endBefore && endAfter) {
    throw new Error(`Content selectors "endBefore" and "endAfter" cannot both be defined. Specify only one in: ${JSON.stringify(rangeSelector)}`);
  }

  if (!((startBefore || startAfter) && (endBefore || endAfter))) {
    throw new Error(`At least one "start" and one "end" should be defined in: ${JSON.stringify(rangeSelector)}`);
  }

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
}

export function convertRelativeURLsToAbsolute(document, baseURL) {
  Array.from(document.querySelectorAll(LINKS_TO_CONVERT_SELECTOR)).forEach(link => {
    link.href = url.resolve(baseURL, link.href);
  });
}
