import { parser as keepAChangelogParser } from 'keep-a-changelog';
import semver from 'semver';

import ChangelogValidationError from './changelogValidationError.js';

export default class Changelog {
  static FUNDER_REGEX = /^> Development of this release was (?:supported|made on a volunteer basis) by (.+)\.$/m;
  static UNRELEASED_REGEX = /## Unreleased[ ]+\[(major|minor|patch)\]/i;
  static CHANGESET_LINK_REGEX = /^_Full changeset and discussions: (.+)._$/m;
  static CHANGESET_LINK_TEMPLATE = PRNumber => `_Full changeset and discussions: [#${PRNumber}](https://github.com/OpenTermsArchive/engine/pull/${PRNumber})._`;
  static CHANGELOG_INTRO = 'All changes that impact users of this module are documented in this file, in the [Common Changelog](https://common-changelog.org) format with some additional specifications defined in the CONTRIBUTING file. This codebase adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).';

  constructor(rawContent) {
    this.rawContent = rawContent;
    this.changelog = keepAChangelogParser(this.rawContent);
    this.changelog.description = Changelog.CHANGELOG_INTRO;
    this.changelog.format = 'markdownlint';
    this.releaseType = this.extractReleaseType();
  }

  extractReleaseType() {
    const match = this.rawContent.match(Changelog.UNRELEASED_REGEX);

    if (match && match[1]) {
      return match[1].toLowerCase();
    }

    return null;
  }

  cleanUnreleased() {
    const index = this.changelog.releases.findIndex(release => !release.version);

    this.changelog.releases.splice(index, 1);
  }

  getVersionContent(version) {
    const release = this.changelog.findRelease(version);

    if (!release) {
      throw new Error(`Version ${version} not found in changelog`);
    }

    return release.toString(this.changelog);
  }

  release(PRNumber) {
    const unreleased = this.changelog.findRelease();

    if (!unreleased) {
      throw new Error('Missing "Unreleased" section');
    }

    const latestVersion = semver.maxSatisfying(this.changelog.releases.map(release => release.version), '*');
    const newVersion = semver.inc(latestVersion, this.releaseType);

    unreleased.setVersion(newVersion);
    unreleased.date = new Date();

    if (PRNumber && !Changelog.CHANGESET_LINK_REGEX.test(unreleased.description)) {
      unreleased.description = `${Changelog.CHANGESET_LINK_TEMPLATE(PRNumber)}\n\n${unreleased.description}`;
    }
  }

  validateUnreleased() {
    const unreleased = this.changelog.findRelease();
    const errors = [];

    if (!unreleased) {
      errors.push(new Error('Missing "Unreleased" section'));
      throw new ChangelogValidationError(errors);
    }

    if (!this.releaseType) {
      errors.push(new Error('Invalid or missing release type for "Unreleased" section. Please ensure the section contains a valid release type (major, minor, or patch)'));
    }

    if (!Changelog.FUNDER_REGEX.test(unreleased.description)) {
      errors.push(new Error('Missing funder in the "Unreleased" section'));
    }

    if (!unreleased.changes || Array.from(unreleased.changes.values()).every(change => !change.length)) {
      errors.push(new Error('Missing or malformed changes in the "Unreleased" section'));
    }

    if (errors.length) {
      throw new ChangelogValidationError(errors);
    }
  }

  toString() {
    return this.changelog.toString();
  }
}
