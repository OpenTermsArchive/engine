export default class Terms {
  constructor({ service, type, sourceDocuments, validUntil }) {
    this.service = service;
    this.type = type;
    this.sourceDocuments = sourceDocuments;

    if (validUntil) {
      this.validUntil = validUntil;
    }
  }

  get hasMultipleSourceDocuments() {
    return this.sourceDocuments.length > 1;
  }

  toPersistence() {
    return {
      name: this.service.name,
      documents: {
        [this.type]: this.hasMultipleSourceDocuments
          ? { combine: this.sourceDocuments.map(sourceDocument => sourceDocument.toPersistence()) }
          : this.sourceDocuments[0].toPersistence(),
      },
    };
  }
}
