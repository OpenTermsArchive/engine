import TurndownService from 'turndown';
import cheerio from 'cheerio';

export default async function sanitize(content, selector) {
  const turndownService = new TurndownService();
  let contentToSanitize = content;

  if (selector) {
    const $ = await cheerio.load(content);
    contentToSanitize = $(selector).html();
  }

  const markdown = turndownService.turndown(contentToSanitize);
  return markdown;
}
