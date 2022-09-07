export default class PageDeclaration {
  constructor({ location, executeClientScripts, contentSelectors, noiseSelectors, filters }) {
    this.location = location;
    this.executeClientScripts = executeClientScripts;
    this.contentSelectors = contentSelectors;
    this.noiseSelectors = noiseSelectors;
    this.filters = filters;
    this.id = new URL(location).pathname.split('/').filter(Boolean).join('-');
  }

  get cssSelectors() {
    const { contentSelectors, noiseSelectors } = this;

    const result = [
      ...PageDeclaration.extractCssSelectorsFromProperty(contentSelectors),
      ...PageDeclaration.extractCssSelectorsFromProperty(noiseSelectors),
    ];

    return result.filter(selector => selector);
  }

  static extractCssSelectorsFromProperty(property) {
    if (Array.isArray(property)) {
      return []
        .concat(property)
        .flatMap(selector => PageDeclaration.extractCssSelectorsFromSelector(selector));
    }

    return PageDeclaration.extractCssSelectorsFromSelector(property);
  }

  static extractCssSelectorsFromSelector(selector) {
    if (typeof selector === 'object') {
      const { startBefore, endBefore, startAfter, endAfter } = selector;

      return [ startBefore, endBefore, startAfter, endAfter ].filter(rangeSelector => rangeSelector);
    }

    return [selector];
  }
}
