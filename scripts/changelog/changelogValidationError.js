export default class ChangelogValidationError extends Error {
  constructor(errorOrErrors) {
    const errors = [].concat(errorOrErrors);

    super(`Invalid Unreleased section:${`\n - ${errors.join('\n - ')}`}`);
    this.name = 'ChangelogValidationError';
    this.errors = errors;
  }
}
