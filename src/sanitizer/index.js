import TurndownService from 'turndown';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();

export default async function sanitize(content, selector) {
  let contentToSanitize = content;

  if (selector) {
    const { document } = new JSDOM(contentToSanitize).window;
    const selectedContent = document.querySelector(selector);

    if (selectedContent) {
      contentToSanitize = selectedContent;
    } else {
      console.log(`Warning: the provider selector "${selector}" has no match in the document.`)
    }
  }

  const markdown = turndownService.turndown(contentToSanitize);
  return markdown;
}
