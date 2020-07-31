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

  if (removeElements) {
    removeElements.forEach(element => {
      Array.from(webPageDOM.querySelectorAll(element)).forEach(node => node.remove());
    });
  }

  let selectedContent = webPageDOM;

  if (typeof selector === 'string') {
    selectedContent = Array.from(webPageDOM.querySelectorAll(selector));
    if (!selectedContent) {
      console.warn(`The provided selector "${selector}" has no match in the web page.`);
    }
  } else if (typeof selector === 'object') {
    const { startBefore, startAfter, endBefore, endAfter } = selector;

    if (startBefore && startAfter) {
      throw new Error('Content selectors "startBefore" and "startAfter" cannot both be defined. Specify only one.');
    }

    if (endBefore && endAfter) {
      throw new Error('Content selectors "endBefore" and "endAfter" cannot both be defined. Specify only one.');
    }

    const selection = selectedContent.createRange();
    selection[startBefore ? 'setStartBefore' : 'setStartAfter'](selectedContent.querySelector(startBefore || startAfter));
    selection[endBefore ? 'setEndBefore' : 'setEndAfter'](selectedContent.querySelector(endBefore || endAfter));
    selectedContent = [selection.extractContents()];
  }

  if (!selectedContent.length) {
    throw new Error(`The provided selector "${selector}" has no match in the web page.`);
  }

  return selectedContent.map(domFragment => turndownService.turndown(domFragment)).join('\n');
}

export function convertRelativeURLsToAbsolute(document, baseURL) {
  Array.from(document.querySelectorAll(LINKS_TO_CONVERT_SELECTOR)).forEach(link => {
    link.href = url.resolve(baseURL, link.href);
  });
}
