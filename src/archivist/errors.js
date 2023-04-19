export class InaccessibleContentError extends Error {
  constructor(message) {
    if (Array.isArray(message)) {
      message = `\n - ${message.join('\n - ')}`;
    }
    super(`The documents cannot be accessed or their contents can not be selected:${message}`);
    this.name = 'InaccessibleContentError';
  }
}
