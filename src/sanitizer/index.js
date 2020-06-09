import TurndownService from 'turndown';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();

export default async function sanitize(content, selector) {
  let contentToSanitize = content;

  if (selector) {
    const { document } = new JSDOM(contentToSanitize).window;
    contentToSanitize = document.querySelector(selector);
  }

  const markdown = turndownService.turndown(contentToSanitize);
  return markdown;
}
