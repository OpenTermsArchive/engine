export function extractCssSelectorsFromDocumentDeclaration(documentDeclaration) {
  const { contentSelectors, noiseSelectors } = documentDeclaration;

  const result = [
    ...extractCssSelectorsFromDocumentProperty(contentSelectors),
    ...extractCssSelectorsFromDocumentProperty(noiseSelectors),
  ];

  return result.filter(selector => selector);
}

function extractCssSelectorsFromDocumentProperty(property) {
  if (Array.isArray(property)) {
    return [].concat(property).flatMap(selector => extractCssSelectors(selector));
  }

  return extractCssSelectors(property);
}

function extractCssSelectors(selector) {
  if (typeof selector === 'object') {
    const { startBefore, endBefore, startAfter, endAfter } = selector;
    return [ startBefore, endBefore, startAfter, endAfter ].filter(rangeSelector => rangeSelector);
  }

  return [ selector ];
}
