export default class DocumentDeclaration {
  constructor({ service, type, location, contentSelectors, noiseSelectors, filters, validUntil = null }) {
    this.service = service;
    this.type = type;
    this.location = location;
    this.contentSelectors = contentSelectors;
    this.noiseSelectors = noiseSelectors;
    this.filters = filters;
    this.validUntil = validUntil;
  }

  getCssSelectors() {
    const { contentSelectors, noiseSelectors } = this;

    const result = [
      ...DocumentDeclaration.extractCssSelectorsFromProperty(contentSelectors),
      ...DocumentDeclaration.extractCssSelectorsFromProperty(noiseSelectors),
    ];

    return result.filter(selector => selector);
  }

  static extractCssSelectorsFromProperty(property) {
    if (Array.isArray(property)) {
      return [].concat(property).flatMap(selector => DocumentDeclaration.extractCssSelectorsFromSelector(selector));
    }

    return DocumentDeclaration.extractCssSelectorsFromSelector(property);
  }

  static extractCssSelectorsFromSelector(selector) {
    if (typeof selector === 'object') {
      const { startBefore, endBefore, startAfter, endAfter } = selector;
      return [ startBefore, endBefore, startAfter, endAfter ].filter(rangeSelector => rangeSelector);
    }

    return [ selector ];
  }
}
