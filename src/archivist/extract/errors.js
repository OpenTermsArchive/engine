export class ExtractDocumentError extends Error {
  constructor(message) {
    super(`The extraction cannot be done: ${message}`);
    this.name = 'ExtractDocumentError';
  }
}
