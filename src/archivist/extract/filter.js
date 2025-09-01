export const LINKS_TO_CONVERT_SELECTOR = 'a[href]:not([href^="#"]):not([href=""])';

export default async function filter(webPageDOM, sourceDocument) {
  await applyCustomFilters(webPageDOM, sourceDocument);
  convertRelativeURLsToAbsolute(webPageDOM, sourceDocument.location);
  discardNonTextualElements(webPageDOM);
  cleanEmailProtectedLinks(webPageDOM);

  return webPageDOM;
}

async function applyCustomFilters(webPageDOM, sourceDocument) {
  const { location, contentSelectors = [], insignificantContentSelectors = [], filters: serviceSpecificFilters = [] } = sourceDocument;

  for (const filterFunction of serviceSpecificFilters) {
    try {
      await filterFunction(webPageDOM, {
        fetch: location,
        select: contentSelectors,
        remove: insignificantContentSelectors,
        filter: serviceSpecificFilters.map(filter => filter.name),
      });
    } catch (error) {
      throw new Error(`The filter function "${filterFunction.name}" failed: ${error}`);
    }
  }
}

function convertRelativeURLsToAbsolute(webPageDOM, baseURL) {
  Array.from(webPageDOM.querySelectorAll(LINKS_TO_CONVERT_SELECTOR)).forEach(link => {
    try {
      link.href = new URL(link.href, baseURL).href;
    } catch (error) {
      // Leave the URL as is if it's invalid in the source document and can't be converted to an absolute URL
    }
  });
}

function discardNonTextualElements(webPageDOM) {
  webPageDOM.querySelectorAll('script, style').forEach(node => node.remove());
}

function cleanEmailProtectedLinks(webPageDOM) {
  webPageDOM.querySelectorAll('a[href*="/email-protection"]').forEach(node => {
    const replacement = webPageDOM.createElement('a');
    const [href] = node.href.split('#');

    Array.from(node.attributes).forEach(attr => {
      if (attr.name === 'href') {
        replacement.setAttribute('href', href);
      } else {
        replacement.setAttribute(attr.name, attr.value);
      }
    });

    replacement.innerHTML = '[email&nbsp;protected]';
    node.parentNode.replaceChild(replacement, node);
  });
}
