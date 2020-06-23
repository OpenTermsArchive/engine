import TurndownService from 'turndown';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();

export default async function sanitize(content, selector, sanitizationPipeline, providerSpecificSanitizers) {
  let contentToSanitize = content;
  let { document } = new JSDOM(contentToSanitize).window;

  if (sanitizationPipeline) {
    sanitizationPipeline.forEach(sanitizerId => {
      // Sanitizers work in place
      providerSpecificSanitizers[sanitizerId](document);
    });
  }

  if (selector) {
    const selectedContent = document.querySelector(selector);

    if (selectedContent) {
      contentToSanitize = selectedContent;
    } else {
      console.warn(`The provided selector "${selector}" has no match in the document.`)
    }
  }

  const markdown = turndownService.turndown(contentToSanitize);
  return markdown;
}
