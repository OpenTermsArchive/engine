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

  toJSON() {
    return {
      name: this.service.name,
      documents: {
        [this.type]: this.pages.length === 1
          ? this.pages[0].toJSON()
          : { combine: this.pages.map(page => page.toJSON()) },
      },
    };
  }
}
