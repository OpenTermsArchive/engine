export default class Service {
  documents = new Map();

  constructor({ id, name }) {
    this.id = id;
    this.name = name;
  }

  getDocumentDeclaration(termsType, date) {
    if (!this.documents[termsType]) {
      return null;
    }

    const { latest: currentlyValidDocumentDeclaration, history } = this.documents[termsType];

    if (!date) {
      return currentlyValidDocumentDeclaration;
    }

    return (
      history?.find(entry => new Date(date) <= new Date(entry.validUntil))
      || currentlyValidDocumentDeclaration
    );
  }

  getTermsTypes() {
    return Object.keys(this.documents);
  }

  addDocumentDeclaration(document) {
    if (!document.service) {
      document.service = this;
    }

    this.documents[document.termsType] = this.documents[document.termsType] || {};

    if (!document.validUntil) {
      this.documents[document.termsType].latest = document;

      return;
    }

    this.documents[document.termsType].history = this.documents[document.termsType].history || [];
    this.documents[document.termsType].history.push(document);
    this.documents[document.termsType].history.sort((a, b) => new Date(a.validUntil) - new Date(b.validUntil));
  }

  getHistoryDates(termsType) {
    return this.documents[termsType].history.map(entry => entry.validUntil);
  }

  getNumberOfTerms() {
    return this.getTermsTypes().length;
  }

  hasHistory() {
    // If a service is loaded without its history it could return false even if a history declaration file exists.
    return Boolean(Object.keys(this.documents).find(termsType => this.documents[termsType].history));
  }
}
