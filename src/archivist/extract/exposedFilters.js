export function removeQueryParams(webPageDOM, paramsToRemove = []) {
  if (typeof paramsToRemove === 'string') {
    paramsToRemove = [paramsToRemove];
  }

  if (!paramsToRemove.length) {
    return;
  }

  const elements = [
    ...webPageDOM.querySelectorAll('a[href]'),
    ...webPageDOM.querySelectorAll('img[src]'),
  ];

  elements.forEach(element => {
    try {
      const url = new URL(element.href || element.src);

      paramsToRemove.forEach(param => url.searchParams.delete(param));
      element[element.tagName === 'A' ? 'href' : 'src'] = url.toString();
    } catch (error) {
      // ignore if the element has not a valid URL
    }
  });
}
