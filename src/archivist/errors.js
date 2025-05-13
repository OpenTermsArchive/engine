export class InaccessibleContentError extends Error {
  constructor(errors) {
    const errorsArray = Array.isArray(errors) ? errors : [errors];
    const reasons = errorsArray.map(error => (error instanceof Error ? error.message : String(error)));

    super(`The documents cannot be accessed or their contents can not be selected:${`\n - ${reasons.join('\n - ')}`}`);
    this.name = 'InaccessibleContentError';
    this.reasons = reasons;
    this.errors = errorsArray;
  }
}
