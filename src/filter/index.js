import url from 'url';

import TurndownService from 'turndown';
import turndownPluginGithubFlavouredMarkdown from 'joplin-turndown-plugin-gfm';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();
turndownService.use(turndownPluginGithubFlavouredMarkdown.gfm);

export const LINKS_TO_CONVERT_SELECTOR = 'a[href]:not([href^="#"])';

export default async function filter(content, selector, location, filterNames, filterFunctions) {
  const { document: webPageDOM } = new JSDOM(content).window;

  if (filterNames) {
    filterNames.forEach(filterName => {
      // Filters work in place
      filterFunctions[filterName](webPageDOM);
    });
  }

  convertRelativeURLsToAbsolute(webPageDOM, location);

  const selectedContent = Array.from(webPageDOM.querySelectorAll(selector));
  if (!selectedContent.length) {
    throw new Error(`The provided selector "${selector}" has no match in the web page.`);
  }

  return selectedContent.map(domFragment => turndownService.turndown(domFragment)).join('\n');
}

export function convertRelativeURLsToAbsolute(document, baseURL) {
  Array.from(document.querySelectorAll(LINKS_TO_CONVERT_SELECTOR)).forEach(link => {
    link.href = url.resolve(baseURL, link.href);
  });
}
