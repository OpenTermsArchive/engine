export default class Service {
  documents = {};

  constructor({ id, name }) {
    this.id = id;
    this.name = name;
  }

  getDocumentDeclaration(documentType, date) {
    if (!this.documents[documentType]) {
      return null;
    }

    const { latest: currentlyValidDocumentDeclaration, history } = this.documents[documentType];

    if (!date) {
      return currentlyValidDocumentDeclaration;
    }

    return ((history && history.find(entry => new Date(date) <= new Date(entry.validUntil))) || currentlyValidDocumentDeclaration);
  }

  getDocumentTypes() {
    return Object.keys(this.documents);
  }

  addDocumentDeclaration(document) {
    if (!document.service) {
      document.service = this;
    }

    this.documents[document.type] = this.documents[document.type] || {};

    if (!document.validUntil) {
      this.documents[document.type].latest = document;

      return;
    }

    this.documents[document.type].history = this.documents[document.type].history || [];
    this.documents[document.type].history.push(document);
    this.documents[document.type].history.sort((a, b) => new Date(a.validUntil) - new Date(b.validUntil));
  }

  getHistoryDates(documentType) {
    return this.documents[documentType].history.map(entry => entry.validUntil);
  }

  getNumberOfDocuments() {
    return this.getDocumentTypes().length;
  }

  hasHistory() {
    // If a service is loaded without its history it could return false even if a history declaration file exists.
    return Boolean(Object.keys(this.documents).find(documentType => this.documents[documentType].history));
  }
}
