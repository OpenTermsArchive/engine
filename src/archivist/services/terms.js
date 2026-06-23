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

  get duplicateSourceDocuments() {
    const seenLocations = new Set();

    return this.sourceDocuments.filter(({ location }) => {
      const isDuplicate = seenLocations.has(location);

      seenLocations.add(location);

      return isDuplicate;
    });
  }

  toPersistence() {
    return {
      name: this.service.name,
      terms: {
        [this.type]: this.hasMultipleSourceDocuments
          ? { combine: this.sourceDocuments.map(sourceDocument => sourceDocument.toPersistence()) }
          : this.sourceDocuments[0].toPersistence(),
      },
    };
  }
}
