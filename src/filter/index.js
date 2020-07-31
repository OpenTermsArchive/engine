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

  let selectedContent = webPageDOM;

  if (removeElements) {
    removeElements.forEach(elementSelector => {
      if (typeof elementSelector === 'object') {
        const rangeSelection = getRangeSelection(selectedContent, elementSelector);
        rangeSelection.deleteContents();
      } else {
        Array.from(webPageDOM.querySelectorAll(elementSelector)).forEach(node => node.remove());
      }
    });
  }

  if (typeof selector === 'string') {
    selectedContent = Array.from(webPageDOM.querySelectorAll(selector));
    if (!selectedContent) {
      console.warn(`The provided selector "${selector}" has no match in the web page.`);
    }
  } else if (typeof selector === 'object') {
    const rangeSelection = getRangeSelection(selectedContent, selector);
    selectedContent = [rangeSelection.extractContents()];
  }

  if (!selectedContent.length) {
    throw new Error(`The provided selector "${selector}" has no match in the web page.`);
  }

  return selectedContent.map(domFragment => turndownService.turndown(domFragment)).join('\n');
}

function getRangeSelection(document, rangeSelector) {
  const { startBefore, startAfter, endBefore, endAfter } = rangeSelector;

  if (startBefore && startAfter) {
    throw new Error('Content selectors "startBefore" and "startAfter" cannot both be defined. Specify only one.');
  }

  if (endBefore && endAfter) {
    throw new Error('Content selectors "endBefore" and "endAfter" cannot both be defined. Specify only one.');
  }

  const selection = document.createRange();
  selection[startBefore ? 'setStartBefore' : 'setStartAfter'](document.querySelector(startBefore || startAfter));
  selection[endBefore ? 'setEndBefore' : 'setEndAfter'](document.querySelector(endBefore || endAfter));

  return selection;
}

export function convertRelativeURLsToAbsolute(document, baseURL) {
  Array.from(document.querySelectorAll(LINKS_TO_CONVERT_SELECTOR)).forEach(link => {
    link.href = url.resolve(baseURL, link.href);
  });
}
