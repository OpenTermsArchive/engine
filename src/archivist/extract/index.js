import mime from 'mime';

import SourceDocument from '../services/sourceDocument.js';

import createWebPageDOM from './dom.js';
import { ExtractDocumentError } from './errors.js';
import filter from './filter.js';
import { transformFromHTML, transformFromPDF } from './markdown.js';

export { ExtractDocumentError } from './errors.js';

/**
 * Extract content from source document and convert it to Markdown
 * @function extract
 * @param   {string}          sourceDocument Source document from which to extract content, see {@link SourceDocument}
 * @returns {Promise<string>}                Promise which is fulfilled once the content is extracted and converted in Markdown. The promise will resolve into a string containing the extracted content in Markdown format
 * @async
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
  const { location, content, contentSelectors, insignificantContentSelectors } = sourceDocument;

  const webPageDOM = createWebPageDOM(content, location);
  const filteredDOM = await filter(webPageDOM, sourceDocument);
  const cleanedDOM = filteredDOM.remove(insignificantContentSelectors);
  const selectedDOM = cleanedDOM.select(contentSelectors);

  if (!selectedDOM?.children.length) {
    throw new Error(`The provided selector "${contentSelectors}" has no match in the web page at '${location}'. This could be due to elements being removed before content selection if "remove" and "select" selectors match the same content.`);
  }

  const markdownContent = transformFromHTML(selectedDOM);

  if (!markdownContent) {
    throw new Error(`The provided selector "${contentSelectors}" matches an empty content in the web page at '${location}'`);
  }

  return markdownContent;
}

export async function extractFromPDF({ location, content: pdfBuffer }) {
  const markdownContent = await transformFromPDF(pdfBuffer);

  if (!markdownContent) {
    throw new Error(`The PDF file at '${location}' contains no text, it might contain scanned images of text instead of actual text`);
  }

  return markdownContent;
}
