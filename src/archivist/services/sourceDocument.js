import path from 'path';

import mime from 'mime';

export default class SourceDocument {
  /**
   * Represents a source document containing web content and metadata for extraction.
   * Includes the document location, selectors for content inclusion/exclusion,
   * content filters, raw content data, and MIME type information.
   * @class SourceDocument
   * @param {object}                    params                               The source document parameters
   * @param {string}                    params.location                      The URL location of the document
   * @param {boolean}                   params.executeClientScripts          Whether to execute client-side scripts
   * @param {(string | object | Array)} params.contentSelectors              CSS selectors for content to include
   * @param {(string | object | Array)} params.insignificantContentSelectors CSS selectors for content to exclude
   * @param {Array}                     params.filters                       Array of filters to apply
   * @param {string}                    params.content                       The document content
   * @param {string}                    params.mimeType                      The MIME type of the content
   */
  constructor({ location, executeClientScripts, contentSelectors, insignificantContentSelectors, filters, content, mimeType }) {
    this.location = location;
    this.executeClientScripts = executeClientScripts;
    this.contentSelectors = contentSelectors;
    this.insignificantContentSelectors = insignificantContentSelectors;
    this.filters = filters;
    this.content = content;
    this.mimeType = mimeType;
    this.id = SourceDocument.generateId(location);
  }

  get cssSelectors() {
    const { contentSelectors, insignificantContentSelectors } = this;

    const result = [
      ...SourceDocument.extractCssSelectorsFromProperty(contentSelectors),
      ...SourceDocument.extractCssSelectorsFromProperty(insignificantContentSelectors),
    ];

    return result.filter(selector => selector);
  }

  clearContent() {
    this.content = null;
    // Keep `mimeType` as it is a short metadata string, the memory-saving rationale only applies to the potentially large content payload, and downstream observers (e.g. tracking-results) need it after the content is cleared
  }

  resetObservations() {
    // mimeType and snapshotId are observations of a single tracking attempt, but they are stored on declaration objects that live for the whole process: without this reset, a failed fetch would expose the previous run's values as if they belonged to the failed attempt.
    // The proper pattern would be for the fetch and extract pipeline to return its observations instead of mutating the declarations, letting consumers build their records from run-scoped data; this reset contains that debt rather than fixing it.
    this.mimeType = null;
    this.snapshotId = null;
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

  static generateId(location) {
    const ILLEGAL_CHARACTERS = /[\\:"<>|*?]/g; // Characters forbidden in filenames for cross-platform compatibility; see https://github.com/actions/toolkit/blob/main/packages/artifact/src/internal/upload/path-and-artifact-name-validation.ts

    const pathname = decodeURIComponent(new URL(location).pathname);
    const extension = path.extname(pathname);
    const pathnameWithoutExtension = mime.getType(extension) ? pathname.slice(0, -extension.length) : pathname; // Remove file extension when it corresponds to a known MIME type, as the extension is not part of the document's identity but a web server implementation detail

    return pathnameWithoutExtension
      .split('/')
      .filter(Boolean)
      .join('-')
      .replace(ILLEGAL_CHARACTERS, '_');
  }

  toPersistence() {
    const persistence = {
      fetch: this.location,
      select: this.contentSelectors,
    };

    // Undeclared fields are omitted rather than set to undefined: JSON.stringify would drop undefined-valued keys on write, so re-reading the persisted form would otherwise yield a different key set than the in-memory one and defeat change detection
    if (this.insignificantContentSelectors !== undefined) {
      persistence.remove = this.insignificantContentSelectors;
    }

    if (this.filters) {
      persistence.filter = this.filters.map(filter => filter.name);
    }

    if (this.executeClientScripts !== undefined) {
      persistence.executeClientScripts = this.executeClientScripts;
    }

    return persistence;
  }
}
