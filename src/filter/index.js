import TurndownService from 'turndown';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();

export default async function filter(url, content, selector, filterNames, filterFunctions) {
  let { document: webPageDOM } = new JSDOM(content).window;

  if (filterNames) {
    for (let filterName of filterNames) {
      await filterFunctions[filterName](webPageDOM, url);
    }
  }

  const selectedContent = Array.from(webPageDOM.querySelectorAll(selector));
  if (!selectedContent.length) {
    console.warn(`The provided selector "${selector}" has no match in the web page.`);
  }

  return selectedContent.map(domFragment => turndownService.turndown(domFragment)).join('\n');
}
