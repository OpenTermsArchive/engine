export class FetchDocumentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FetchDocumentError';
  }
}
