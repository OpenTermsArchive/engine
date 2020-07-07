import config from 'config';
import TurndownService from 'turndown';
import DatauriParser from 'datauri/parser.js';
import jsdom from 'jsdom';

import fetch from '../fetcher/index.js';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();
const dataUriParser = new DatauriParser();

function cleanAttribute (attribute) {
  return attribute ? attribute.replace(/(\n+\s*)+/g, '\n') : '';
}

function buildLocalImageRule(url) {
  return async function (content, node) {
    var src = node.getAttribute('src') || ''
    if (!src) {
      return '';
    }

    var alt = cleanAttribute(node.getAttribute('alt'))
    var title = cleanAttribute(node.getAttribute('title'))
    var titlePart = title ? ' "' + title + '"' : ''

    let localSrc = src;
    if (!src.startsWith('data:')) {  // Not a data-URI, download content
      let queryUrl = src;
      if (!src.startsWith('http:') && !src.startsWith('https:')) {  // Relative URL
        queryUrl = new URL(src, url).href;
      }
      const blob = await fetch(queryUrl, false);
      const type = blob.type;
      const arrayBuffer = await blob.arrayBuffer();
      localSrc = dataUriParser.format(`.${type.split('/')[1]}`, arrayBuffer);
    }
    return '![' + alt + ']' + '(' + localSrc + titlePart + ')';
  }
}


export default async function filter(url, content, selector, filterNames, filterFunctions) {
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
