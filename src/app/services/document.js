export default class Document {
  constructor({ service, type, location, contentSelectors, noiseSelectors, filters, validUntil = null }) {
    this.service = service;
    this.type = type;
    this.location = location;
    this.contentSelectors = contentSelectors;
    this.noiseSelectors = noiseSelectors;
    this.filters = filters;
    this.validUntil = validUntil;
  }
}
