import ciceroMark from '@accordproject/markdown-cicero';
import mardownPdf from '@accordproject/markdown-pdf';
import TurndownService from '@opentermsarchive/turndown';
import turndownPluginGithubFlavouredMarkdown from 'joplin-turndown-plugin-gfm';
import jsdom from 'jsdom';
import mime from 'mime';

import { ExtractDocumentError } from './errors.js';

export { ExtractDocumentError } from './errors.js';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();

turndownService.use(turndownPluginGithubFlavouredMarkdown.gfm);

export const LINKS_TO_CONVERT_SELECTOR = 'a[href]:not([href^="#"]):not([href=""])';

const { PdfTransformer } = mardownPdf;
const { CiceroMarkTransformer } = ciceroMark;

const ciceroMarkTransformer = new CiceroMarkTransformer();

/**
 * Extract content from source document and convert it to Markdown
 *
 * @function extract
 * @param {string} sourceDocument - Source document from which to extract content, see {@link ./src/archivist/services/sourceDocument.js}
 * @returns {Promise<string>} Promise which is fulfilled once the content is extracted and converted in Markdown. The promise will resolve into a string containing the extracted content in Markdown format
*/
export default async function extract(sourceDocument) {
  try {
    if (sourceDocument.mimeType == mime.getType('pdf')) {
      return await extractFromPDF(sourceDocument);
    }

    return await extractFromHTML(sourceDocument);
  } catch (error) {
    throw new ExtractDocumentError(error.message);
  }
}

export async function extractFromHTML(sourceDocument) {
  const {
    location,
    contentSelectors = [],
    insignificantContentSelectors = [],
    filters: serviceSpecificFilters = [],
    content,
  } = sourceDocument;

  const jsdomInstance = new JSDOM(content, {
    url: location,
    virtualConsole: new jsdom.VirtualConsole(),
  });
  const { document: webPageDOM } = jsdomInstance.window;

  for (const filterFunction of serviceSpecificFilters) {
    try {
      /* eslint-disable no-await-in-loop */
      // We want this to be made in series
      await filterFunction(webPageDOM, {
        fetch: location,
        select: contentSelectors,
        remove: insignificantContentSelectors,
        filter: serviceSpecificFilters.map(filter => filter.name),
      });
      /* eslint-enable no-await-in-loop */
    } catch (error) {
      throw new Error(`The filter function "${filterFunction.name}" failed: ${error}`);
    }
  }

  remove(webPageDOM, insignificantContentSelectors); // remove function works in place

  const domFragment = select(webPageDOM, contentSelectors);

  if (!domFragment.children.length) {
    throw new Error(`The provided selector "${contentSelectors}" has no match in the web page at '${location}'`);
  }

  convertRelativeURLsToAbsolute(domFragment, location);

  domFragment.querySelectorAll('script, style').forEach(node => node.remove());

  // clean code from common changing patterns - initially for Windstream
  domFragment.querySelectorAll('a[href*="/email-protection"]').forEach(node => {
    const newProtectedLink = webPageDOM.createElement('a');
    const [href] = node.href.split('#');

    newProtectedLink.href = href;
    newProtectedLink.innerHTML = '[email protected]';
    node.parentNode.replaceChild(newProtectedLink, node);
  });

  const markdownContent = transform(domFragment);

  if (!markdownContent) {
    throw new Error(`The provided selector "${contentSelectors}" matches an empty content in the web page at '${location}'`);
  }

  return markdownContent;
}

export async function extractFromPDF({ location, content: pdfBuffer }) {
  let markdownContent;

  try {
    const ciceroMarkdown = await PdfTransformer.toCiceroMark(pdfBuffer);

    markdownContent = ciceroMarkTransformer.toMarkdown(ciceroMarkdown);
  } catch (error) {
    if (error.parserError) {
      throw new Error("Can't parse PDF file");
    }

    throw error;
  }

  if (!markdownContent) {
    throw new Error(`The PDF file at '${location}' contains no text, it might contain scanned images of text instead of actual text`);
  }

  return markdownContent;
}

function selectRange(webPageDOM, rangeSelector) {
  const { startBefore, startAfter, endBefore, endAfter } = rangeSelector;

  const selection = webPageDOM.createRange();
  const startNode = webPageDOM.querySelector(startBefore || startAfter);
  const endNode = webPageDOM.querySelector(endBefore || endAfter);

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

export function convertRelativeURLsToAbsolute(webPageDOM, baseURL) {
  Array.from(webPageDOM.querySelectorAll(LINKS_TO_CONVERT_SELECTOR)).forEach(link => {
    try {
      link.href = new URL(link.href, baseURL).href;
    } catch (error) {
      // Leave the URL as is if it's invalid in the source document and can't be converted to an absolute URL
    }
  });
}

// Works in place
function remove(webPageDOM, insignificantContentSelectors) {
  const rangeSelections = [];
  const nodes = [];

  [].concat(insignificantContentSelectors).forEach(selector => {
    if (typeof selector === 'object') {
      rangeSelections.push(selectRange(webPageDOM, selector));
    } else {
      nodes.push(...webPageDOM.querySelectorAll(selector));
    }
  });

  // Removing range selections still works even if the starting or ending node is deleted. So, start by removing all nodes selected by a direct CSS selector, then delete all contents selections.
  nodes.forEach(node => node.remove());
  rangeSelections.forEach(rangeSelection => rangeSelection.deleteContents());
}

function select(webPageDOM, contentSelectors) {
  const result = webPageDOM.createDocumentFragment();

  [].concat(contentSelectors).forEach(selector => {
    if (typeof selector === 'object') {
      const rangeSelection = selectRange(webPageDOM, selector);

      result.appendChild(rangeSelection.cloneContents());
    } else {
      webPageDOM.querySelectorAll(selector).forEach(element => result.appendChild(element.cloneNode(true)));
    }
  });

  return result;
}

function transform(domFragment) {
  return turndownService.turndown(domFragment);
}
