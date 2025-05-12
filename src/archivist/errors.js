export class InaccessibleContentError extends Error {
  constructor(errorOrErrors) {
    const errors = [].concat(errorOrErrors);
    const reasons = errors.map(error => (error instanceof Error ? error.message : error));

    super(`The documents cannot be accessed or their contents can not be selected:${`\n - ${reasons.join('\n - ')}`}`);
    this.name = 'InaccessibleContentError';
    this.reasons = reasons;
    this.errors = errors;
  }
}
