export class InaccessibleContentError extends Error {
  constructor(message) {
    super(`The document cannot be accessed or its content can not be selected: ${message}`);
  }
}
