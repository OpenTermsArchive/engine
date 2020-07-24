import TurndownService from 'turndown';
import turndownPluginGithubFlavouredMarkdown from 'turndown-plugin-gfm';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();
turndownService.use(turndownPluginGithubFlavouredMarkdown.gfm);


export default async function filter(content, selector, filterNames, filterFunctions) {
  let { document: webPageDOM } = new JSDOM(content).window;

  if (filterNames) {
    filterNames.forEach(filterName => {
      // Filters work in place
      filterFunctions[filterName](webPageDOM);
    });
  }

  const selectedContent = Array.from(webPageDOM.querySelectorAll(selector));
  if (!selectedContent.length) {
    console.warn(`The provided selector "${selector}" has no match in the web page.`);
  }

  return selectedContent.map(domFragment => turndownService.turndown(domFragment)).join('\n');
}
