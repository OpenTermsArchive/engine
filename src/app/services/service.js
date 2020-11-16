export default class Service {
  constructor({ id, name }) {
    this.id = id;
    this.name = name;
    this._documents = {};
  }

  getDocumentDeclaration(documentType, date) {
    if (!this._documents[documentType]) {
      return null;
    }

    const { _latest: currentlyValidDocumentDeclaration, _history } = this._documents[documentType];
    if (!date) {
      return currentlyValidDocumentDeclaration;
    }

    if (!_history) {
      throw new Error('History not loaded. Use "loadWithHistory".');
    }

    return _history.find(entry => new Date(date) <= new Date(entry.validUntil)) || currentlyValidDocumentDeclaration;
  }

  getDocumentTypes() {
    return Object.keys(this._documents);
  }

  addDocumentDeclaration(document) {
    if (!document.service) {
    if (!document.validUntil) {
      this._documents[document.type] = this._documents[document.type] || {};
      this._documents[document.type]._latest = document;
      return;
    }

    this._documents[document.type]._history = this._documents[document.type]._history || [];
    this._documents[document.type]._history.push(document);
    this._documents[document.type]._history.sort((a, b) => new Date(a.validUntil) - new Date(b.validUntil));
  }
}
