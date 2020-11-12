export default class Service {
  constructor({ id, name }) {
    this.id = id;
    this.name = name;
    this._documents = {};
  }

  getDocument(documentType, date) {
    if (!date) {
      return this._documents[documentType]._latest;
    }

    return this._documents[documentType]._history.find(entry => new Date(date) <= new Date(entry.validUntil));
  }

  getDocumentTypes() {
    return Object.keys(this._documents);
  }

  addDocument(document) {
    if (!document.validUntil) {
      this._documents[document.type] = {
        _latest: document
      };
      return;
    }

    this._documents[document.type]._history = this._documents[document.type]._history || [];
    this._documents[document.type]._history.push(document);
    this._documents[document.type]._history.sort((a, b) => new Date(a.validUntil) - new Date(b.validUntil));
  }
}
