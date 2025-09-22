export function removeQueryParams(webPageDOM, paramsToRemove = []) {
  const normalizedParams = Array.isArray(paramsToRemove) ? paramsToRemove : [paramsToRemove];

  if (!normalizedParams.length) {
    return;
  }

  const elements = webPageDOM.querySelectorAll('a[href], img[src]');

  for (const element of elements) {
    try {
      const urlString = element.href || element.src;
      const url = new URL(urlString);

      const hasTargetParams = normalizedParams.some(param => url.searchParams.has(param));

      if (hasTargetParams) {
        normalizedParams.forEach(param => url.searchParams.delete(param));

        const attributeName = element.tagName === 'A' ? 'href' : 'src';

        element[attributeName] = url.toString();
      }
    } catch {
      // Silently ignore invalid URLs
    }
  }
}
