import TurndownService from 'turndown';
import turndownPluginGithubFlavouredMarkdown from 'joplin-turndown-plugin-gfm';
import jsdom from 'jsdom';
import urlToolkit from 'url-toolkit';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();
turndownService.use(turndownPluginGithubFlavouredMarkdown.gfm);


export default async function filter(content, selector, location, filterNames, filterFunctions) {
  let { document: webPageDOM } = new JSDOM(content).window;

  if (filterNames) {
    filterNames.forEach(filterName => {
      // Filters work in place
      filterFunctions[filterName](webPageDOM);
    });
  }

  convertRelativeURLsToAbsolute(webPageDOM, location);

  const selectedContent = Array.from(webPageDOM.querySelectorAll(selector));
  if (!selectedContent.length) {
    console.warn(`The provided selector "${selector}" has no match in the web page.`);
  }

  return selectedContent.map(domFragment => turndownService.turndown(domFragment)).join('\n');
}

export function convertRelativeURLsToAbsolute(document, baseURL) {
  Array.from(document.querySelectorAll('a[href]:not([href=""]')).forEach(link => {
    link.href = urlToolkit.buildAbsoluteURL(baseURL, link.href);
  });
}
