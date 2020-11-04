export function extractCssSelectorsFromDocumentDeclaration(documentDeclaration) {
  const { select, remove } = documentDeclaration;

  const result = [
    ...extractCssSelectorsFromDocumentProperty(select),
    ...extractCssSelectorsFromDocumentProperty(remove),
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
