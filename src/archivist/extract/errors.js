export class ExtractDocumentError extends Error {
  constructor(message) {
    super(`Extract failed: ${message}`);
    this.name = 'ExtractDocumentError';
  }
}
