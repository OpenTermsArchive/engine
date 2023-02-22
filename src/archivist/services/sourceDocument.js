export default class SourceDocument {
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
      ...SourceDocument.extractCssSelectorsFromProperty(contentSelectors),
      ...SourceDocument.extractCssSelectorsFromProperty(noiseSelectors),
    ];

    return result.filter(selector => selector);
  }

  static extractCssSelectorsFromProperty(property) {
    if (Array.isArray(property)) {
      return []
        .concat(property)
        .flatMap(selector => SourceDocument.extractCssSelectorsFromSelector(selector));
    }

    return SourceDocument.extractCssSelectorsFromSelector(property);
  }

  static extractCssSelectorsFromSelector(selector) {
    if (typeof selector === 'object') {
      const { startBefore, endBefore, startAfter, endAfter } = selector;

      return [ startBefore, endBefore, startAfter, endAfter ].filter(rangeSelector => rangeSelector);
    }

    return [selector];
  }

  toPersistence() {
    return {
      fetch: this.location,
      select: this.contentSelectors,
      remove: this.noiseSelectors,
      filter: this.filters ? this.filters.map(filter => filter.name) : undefined,
      executeClientScripts: this.executeClientScripts,
    };
  }
}
