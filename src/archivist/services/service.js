export default class Service {
  terms = new Map();

  constructor({ id, name }) {
    this.id = id;
    this.name = name;
  }

  getTerms({ type, date } = {}) {
    if (type) {
      if (date) {
        return this.#getTermsAtDate(type, date);
      }

      return this.#getTermsAtDate(type, new Date());
    }

    if (date) {
      return this.getTermsTypes().map(termsType => this.#getTermsAtDate(termsType, date));
    }

    return this.getTermsTypes().map(termsType => this.#getTermsAtDate(termsType, new Date()));
  }

  #getTermsAtDate(termsType, date) {
    const { latest: currentlyValidTerms, history } = this.terms[termsType];

    return history?.find(entry => new Date(date) <= new Date(entry.validUntil)) || currentlyValidTerms;
  }

  getTermsTypes() {
    return Object.keys(this.terms);
  }

  addTerms(terms) {
    if (!terms.service) {
      terms.service = this;
    }

    this.terms[terms.type] = this.terms[terms.type] || {};

    if (!terms.validUntil) {
      this.terms[terms.type].latest = terms;

      return;
    }

    this.terms[terms.type].history = this.terms[terms.type].history || [];
    this.terms[terms.type].history.push(terms);
    this.terms[terms.type].history.sort((a, b) => new Date(a.validUntil) - new Date(b.validUntil));
  }

  getHistoryDates(termsType) {
    return this.terms[termsType].history.map(entry => entry.validUntil);
  }

  getNumberOfTerms() {
    return this.getTermsTypes().length;
  }

  hasHistory() {
    // If a service is loaded without its history it could return false even if a history declaration file exists.
    return Boolean(Object.keys(this.terms).find(termsType => this.terms[termsType].history));
  }

  static getNumberOfTerms(services, servicesIds) {
    return servicesIds.reduce((acc, serviceId) => acc + services[serviceId].getNumberOfTerms(), 0);
  }
}
