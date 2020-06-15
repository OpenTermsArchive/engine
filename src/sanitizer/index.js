import TurndownService from 'turndown';
import jsdom from 'jsdom';

import * as sanitizers from './sanitizers.js';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();

export default async function sanitize(content, selector, sanitizationPipeline) {
  let contentToSanitize = content;
  const { document } = new JSDOM(contentToSanitize).window;

  if (selector) {
    const selectedContent = document.querySelector(selector);

    if (selectedContent) {
      contentToSanitize = selectedContent;
    } else {
      console.warn(`The provided selector "${selector}" has no match in the document.`)
    }
  }

  if (sanitizationPipeline) {
    sanitizationPipeline.forEach(sanitization => {
      sanitizers[sanitization](document);
    });
  }

  const markdown = turndownService.turndown(contentToSanitize);
  return markdown;
}
