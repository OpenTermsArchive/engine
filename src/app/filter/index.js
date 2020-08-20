import url from 'url';

import TurndownService from 'turndown';
import turndownPluginGithubFlavouredMarkdown from 'joplin-turndown-plugin-gfm';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();
turndownService.use(turndownPluginGithubFlavouredMarkdown.gfm);

export const LINKS_TO_CONVERT_SELECTOR = 'a[href]:not([href^="#"])';

export default async function filter(content, { fetch: location, select: extractionSelectors = [], remove: deletionSelectors = [], filter: serviceSpecificFilters = [] }, filterFunctions) {
  const virtualConsole = new jsdom.VirtualConsole();
  const jsdomInstance = new JSDOM(content, {
    url: location,
    virtualConsole
  });
  const { document: webPageDOM } = jsdomInstance.window;
  serviceSpecificFilters.forEach(filterName => {
    filterFunctions[filterName](webPageDOM); // filters work in place
  });

  remove(webPageDOM, deletionSelectors); // remove function works in place

  const domFragment = select(webPageDOM, extractionSelectors);

  if (!domFragment.children.length) {
    throw new Error(`The provided selector "${extractionSelectors}" has no match in the web page.`);
  }

  convertRelativeURLsToAbsolute(domFragment, location);

  return transform(domFragment);
}

function selectRange(document, rangeSelector) {
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

// Works in place
function remove(webPageDOM, deletionSelectors) {
  [].concat(deletionSelectors).forEach(selector => {
    if (typeof selector === 'object') {
      const rangeSelection = selectRange(webPageDOM, selector);
      rangeSelection.deleteContents();
    } else {
      Array.from(webPageDOM.querySelectorAll(selector)).forEach(node => node.remove());
    }
  });
}

function select(webPageDOM, extractionSelectors) {
  const result = webPageDOM.createDocumentFragment();

  [].concat(extractionSelectors).forEach(selector => {
    if (typeof selector === 'object') {
      const rangeSelection = selectRange(webPageDOM, selector);
      result.appendChild(rangeSelection.cloneContents());
    } else {
      webPageDOM.querySelectorAll(selector).forEach(element => result.appendChild(element));
    }
  });

  return result;
}

function transform(domFragment) {
  return turndownService.turndown(domFragment);
}
