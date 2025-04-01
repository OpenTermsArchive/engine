/**
 * @module SourceDocument
 * @class SourceDocument
 * Represents a source document with its location, content, and processing configuration
 */
export default class SourceDocument {
  /**
   * Creates a new SourceDocument instance
   * @param {Object} params - The source document parameters
   * @param {string} params.location - The URL location of the document
   * @param {boolean} params.executeClientScripts - Whether to execute client-side scripts
   * @param {(string|Object|Array)} params.contentSelectors - CSS selectors for content to include
   * @param {(string|Object|Array)} params.insignificantContentSelectors - CSS selectors for content to exclude
   * @param {Array} params.filters - Array of filters to apply
   * @param {string} params.content - The document content
   * @param {string} params.mimeType - The MIME type of the content
   */
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
