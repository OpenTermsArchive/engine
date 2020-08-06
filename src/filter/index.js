import url from 'url';

import TurndownService from 'turndown';
import turndownPluginGithubFlavouredMarkdown from 'joplin-turndown-plugin-gfm';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();
turndownService.use(turndownPluginGithubFlavouredMarkdown.gfm);

export const LINKS_TO_CONVERT_SELECTOR = 'a[href]:not([href^="#"])';

export default async function filter(content, { fetch: location, select: extractionSelectors = [], remove: deletionSelectors = [], filter: serviceSpecificFilters = [] }, filterFunctions) {
  const { document: webPageDOM } = new JSDOM(content).window;

  serviceSpecificFilters.forEach(filterName => {
    filterFunctions[filterName](webPageDOM); // Filters work in place
  });

  convertRelativeURLsToAbsolute(webPageDOM, location);

  remove(webPageDOM, deletionSelectors); // work in place

  const selectedContents = select(webPageDOM, extractionSelectors);

  if (!selectedContents.length) {
    throw new Error(`The provided selector "${extractionSelectors}" has no match in the web page.`);
  }

  return transform(selectedContents);
}

function getRangeSelection(document, rangeSelector) {
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
}

export function convertRelativeURLsToAbsolute(document, baseURL) {
  Array.from(document.querySelectorAll(LINKS_TO_CONVERT_SELECTOR)).forEach(link => {
    link.href = url.resolve(baseURL, link.href);
  });
}

function remove(webPageDOM, deletionSelectors) {
  [].concat(deletionSelectors).forEach(selector => {
    if (typeof selector === 'object') {
      const rangeSelection = getRangeSelection(webPageDOM, selector);
      rangeSelection.deleteContents();
    } else {
      Array.from(webPageDOM.querySelectorAll(selector)).forEach(node => node.remove());
    }
  });
}

function select(webPageDOM, extractionSelectors) {
  const selectedContents = [];
  [].concat(extractionSelectors).forEach(selector => {
    if (typeof selector === 'object') {
      const rangeSelection = getRangeSelection(webPageDOM, selector);
      selectedContents.push(rangeSelection.cloneContents());
    } else {
      selectedContents.push(...Array.from(webPageDOM.querySelectorAll(selector)));
    }
  });

  return selectedContents;
}

function transform(selectedContents) {
  return selectedContents.map(domFragment => turndownService.turndown(domFragment)).join('\n');
}
