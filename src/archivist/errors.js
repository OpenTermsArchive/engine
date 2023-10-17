export class InaccessibleContentError extends Error {
  constructor(message) {
    super(`The documents cannot be accessed or their contents can not be selected:${Array.isArray(message) ? `\n - ${message.join('\n - ')}` : message}`);
    this.name = 'InaccessibleContentError';
    this.reasons = Array.isArray(message) ? message : [message];
  }
}
