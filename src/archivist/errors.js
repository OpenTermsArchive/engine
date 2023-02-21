export class InaccessibleContentError extends Error {
  constructor(message) {
    if (Array.isArray(message)) {
      message = `\n - ${message.join('\n - ')}`;
    }
    super(`The terms cannot be accessed or its content can not be selected:${message}`);
    this.name = 'InaccessibleContentError';
  }
}
