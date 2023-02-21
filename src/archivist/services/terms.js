export default class Terms {
  constructor({ service, termsType, documents, validUntil }) {
    this.service = service;
    this.termsType = termsType;
    this.documents = documents;

    if (validUntil) {
      this.validUntil = validUntil;
    }
  }

  get isMultiDocument() {
    return this.documents.length > 1;
  }

  toPersistence() {
    return {
      name: this.service.name,
      documents: {
        [this.termsType]: this.isMultiDocument
          ? { combine: this.documents.map(page => page.toPersistence()) }
          : this.documents[0].toPersistence(),
      },
    };
  }
}
