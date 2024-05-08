export class FetchDocumentError extends Error {
  constructor(message) {
    super(`Fetch failed: ${message}`);
    this.name = 'FetchDocumentError';
  }
}
