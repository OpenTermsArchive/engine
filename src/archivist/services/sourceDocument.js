export default class SourceDocument {
  constructor({ location, executeClientScripts, contentSelectors, insignificantContentSelectors, filters, content, mimeType }) {
    this.location = location;
    this.executeClientScripts = executeClientScripts;
    this.contentSelectors = contentSelectors;
    this.insignificantContentSelectors = insignificantContentSelectors;
    this.filters = filters;
    this.content = content;
    this.mimeType = mimeType;
    this.id = new URL(location).pathname.split('/').filter(Boolean).join('-');
  }

  get cssSelectors() {
    const { contentSelectors, insignificantContentSelectors } = this;

    const result = [
      ...SourceDocument.extractCssSelectorsFromProperty(contentSelectors),
      ...SourceDocument.extractCssSelectorsFromProperty(insignificantContentSelectors),
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
      remove: this.insignificantContentSelectors,
      filter: this.filters ? this.filters.map(filter => filter.name) : undefined,
      executeClientScripts: this.executeClientScripts,
    };
  }
}
