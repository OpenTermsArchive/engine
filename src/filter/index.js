import TurndownService from 'turndown';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();

export default async function filter(content, selector, filterNames, filterFunctions) {
  let contentToFilter = content;
  let { document: webPageDOM } = new JSDOM(contentToFilter).window;

  if (filterNames) {
    filterNames.forEach(filterName => {
      // Filters work in place
      filterFunctions[filterName](webPageDOM);
    });
  }

  if (selector) {
    const selectedContent = webPageDOM.querySelectorAll(selector);
    if (selectedContent) {
      contentToFilter = selectedContent;
    } else {
      console.warn(`The provided selector "${selector}" has no match in the web page.`)
    }
  }

  let markdown = "";
  contentToFilter.forEach(next_content => {markdown += turndownService.turndown(next_content)+"\n";});
  const markdown_final = markdown;
  return markdown_final;
}
