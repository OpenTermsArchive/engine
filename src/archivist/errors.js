export class InaccessibleContentError extends Error {
  constructor(reasonOrReasons) {
    const reasons = [].concat(reasonOrReasons);

    super(`The documents cannot be accessed or their contents can not be selected:${`\n - ${reasons.join('\n - ')}`}`);
    this.name = 'InaccessibleContentError';
    this.reasons = reasons;
  }
}
