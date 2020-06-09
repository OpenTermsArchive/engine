import TurndownService from 'turndown';
import jsdom from 'jsdom';
const { JSDOM } = jsdom;

export default async function sanitize(content, selector) {
  const turndownService = new TurndownService();
  let contentToSanitize = content;

  if (selector) {
    const { document } = new JSDOM(contentToSanitize).window;
    contentToSanitize = document.querySelector(selector);
  }

  const markdown = turndownService.turndown(contentToSanitize);
  return markdown;
}
