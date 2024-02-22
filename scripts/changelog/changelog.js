import { parser as keepAChangelogParser } from 'keep-a-changelog';
import semver from 'semver';

import ChangelogValidationError from './changelogValidationError.js';

export default class Changelog {
  static FUNDER_REGEX = /^> Development of this release was(.+)$/m;
  static CHANGESET_LINK_TEMPLATE = PRNumber => `_Full changeset and discussions: [#${PRNumber}](https://github.com/OpenTermsArchive/engine/pull/${PRNumber})._`;

  constructor(rawContent) {
    this.rawContent = rawContent;
    this.changelog = keepAChangelogParser(this.rawContent);
    this.changelog.format = 'markdownlint';
    this.releaseType = this.extractReleaseType();
  }

  extractReleaseType() {
    const unreleasedRegex = /## Unreleased[ ]+\[(major|minor|patch)\]/i;
    const match = this.rawContent.match(unreleasedRegex);

    if (match && match[1]) {
      return match[1].toLowerCase();
    }

    return null;
  }

  getReleaseType() {
    return this.releaseType;
  }

  getVersionContent(version) {
    const release = this.changelog.findRelease(version);

    if (!release) {
      throw new Error(`Version ${version} not found in changelog`);
    }

    return release.toString();
  }

  release(PRNumber) {
    const currentVersion = semver.maxSatisfying(this.changelog.releases.map(release => release.version), '*');
    const newVersion = semver.inc(currentVersion, this.releaseType);

    const unreleased = this.changelog.findRelease();

    if (!unreleased) {
      throw new Error('Missing Unreleased section. Cannot convert it into a release');
    }

    unreleased.date = new Date();
    unreleased.setVersion(newVersion);

    if (PRNumber) {
      unreleased.description = `${Changelog.CHANGESET_LINK_TEMPLATE(PRNumber)}\n\n${unreleased.description}`;
    }
  }

  validateUnreleased() {
    const unreleased = this.changelog.findRelease();
    const errors = [];

    if (!unreleased) {
      errors.push(new Error('Missing Unreleased section'));
      throw new ChangelogValidationError(errors);
    }

    if (!this.releaseType) {
      errors.push(new Error('Invalid or missing release type for Unreleased section. Please ensure the section contains a valid release type (major, minor, or patch)'));
    }

    if (!Changelog.FUNDER_REGEX.test(unreleased.description)) {
      errors.push(new Error('Missing funder in the Unreleased section'));
    }

    if (!unreleased.changes || Array.from(unreleased.changes.values()).every(change => !change.length)) {
      errors.push(new Error('Missing changes in the Unreleased section'));
    }

    if (errors.length) {
      throw new ChangelogValidationError(errors);
    }
  }

  toString() {
    return this.changelog.toString();
  }
}
