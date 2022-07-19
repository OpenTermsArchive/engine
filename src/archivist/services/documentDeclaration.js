export default class DocumentDeclaration {
  constructor({ service, type, pages, validUntil }) {
    this.service = service;
    this.type = type;
    this.pages = pages;

    if (validUntil) {
      this.validUntil = validUntil;
    }
  }

  get isMultiPage() {
    return this.pages.length > 1;
  }
}
