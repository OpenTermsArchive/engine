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

  toPersistence() {
    return {
      name: this.service.name,
      documents: {
        [this.type]: this.isMultiPage
          ? { combine: this.pages.map(page => page.toPersistence()) }
          : this.pages[0].toPersistence(),
      },
    };
  }
}
