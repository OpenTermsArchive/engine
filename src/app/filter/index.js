import url from 'url';

import jsdom from 'jsdom';
import TurndownService from 'turndown';
import turndownPluginGithubFlavouredMarkdown from 'joplin-turndown-plugin-gfm';
import mardownPdf from '@accordproject/markdown-pdf';
import ciceroMark from '@accordproject/markdown-cicero';

import { InaccessibleContentError } from '../errors.js';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();
turndownService.use(turndownPluginGithubFlavouredMarkdown.gfm);

export const LINKS_TO_CONVERT_SELECTOR = 'a[href]:not([href^="#"])';

const { PdfTransformer } = mardownPdf;
const { CiceroMarkTransformer } = ciceroMark;
const pdfTransformer = new PdfTransformer();
const ciceroMarkTransformer = new CiceroMarkTransformer();

export default async function filter({ content, mimeType, documentDeclaration, filterFunctions }) {
  if (mimeType == 'application/pdf') {
    return filterPDF({ content });
  }

  return filterHTML({
    content,
    documentDeclaration,
    filterFunctions
  });
}

export async function filterHTML({ content, documentDeclaration, filterFunctions }) {
  const {
    fetch: location,
    select: extractionSelectors = [],
    remove: deletionSelectors = [],
    filter: serviceSpecificFilters = []
  } = documentDeclaration;

  const jsdomInstance = new JSDOM(content, {
    url: location,
    virtualConsole: new jsdom.VirtualConsole(),
  });
  const { document: webPageDOM } = jsdomInstance.window;

  for (const filterName of serviceSpecificFilters) {
    try {
      await filterFunctions[filterName](webPageDOM, documentDeclaration); // eslint-disable-line no-await-in-loop
    } catch (error) {
      throw new InaccessibleContentError(`The filter function ${filterName} failed: ${error}`);
    }
  }

  remove(webPageDOM, deletionSelectors); // remove function works in place

  const domFragment = select(webPageDOM, extractionSelectors);

  if (!domFragment.children.length) {
    throw new InaccessibleContentError(`The provided selector "${extractionSelectors}" has no match in the web page.`);
  }

  convertRelativeURLsToAbsolute(domFragment, location);

  return transform(domFragment);
}

export async function filterPDF({ content: pdfBuffer }) {
  const ciceroMarkdown = await pdfTransformer.toCiceroMark(pdfBuffer);

  return ciceroMarkTransformer.toMarkdown(ciceroMarkdown);
}

function selectRange(document, rangeSelector) {
  const { startBefore, startAfter, endBefore, endAfter } = rangeSelector;

  const selection = document.createRange();
  const startNode = document.querySelector(startBefore || startAfter);
  const endNode = document.querySelector(endBefore || endAfter);

  if (!startNode) {
    throw new InaccessibleContentError(`The "start" selector has no match in document in: ${JSON.stringify(rangeSelector)}`);
  }

  if (!endNode) {
    throw new InaccessibleContentError(`The "end" selector has no match in document in: ${JSON.stringify(rangeSelector)}`);
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
