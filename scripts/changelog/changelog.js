import semver from 'semver';

import { parser } from './parser.js';

export function checkChangelog(changelogContent) {
  let changelog;

  try {
    changelog = parser(changelogContent);
  } catch (error) {
    throw new Error('Changelog cannot be parsed:', error);
  }

  const unreleased = changelog.findRelease();

  if (!unreleased) {
    throw new Error('Missing Unreleased section');
  }

  const releaseType = extractReleaseType(changelogContent);

  if (!releaseType) {
    throw new Error('Invalid or missing release type in the changelog. Please ensure the changelog contains a valid release type (major, minor, or patch)');
  }

  if (!checkFunder(unreleased.description)) {
    throw new Error('Missing funder in the Unreleased section');
  }

  if (Array.from(unreleased.changes.values()).every(change => !change.length)) {
    throw new Error('Missing changes in the Unreleased section');
  }

  return true;
}

export function updateChangelog(changelogContent, PRNumber) {
  try {
    const releaseType = extractReleaseType(changelogContent);

    if (!releaseType) {
      throw new Error('Invalid or missing release type in the changelog. Please ensure the changelog contains a valid release type (major, minor, or patch)');
    }

    const changelog = parser(changelogContent);

    const currentVersion = semver.maxSatisfying(changelog.releases.map(release => release.version), '*');
    const newVersion = semver.inc(currentVersion, releaseType);

    const unreleased = changelog.findRelease();

    unreleased.date = new Date();
    unreleased.setVersion(newVersion);

    if (PRNumber) {
      unreleased.description = `${generatePRLink(PRNumber)}\n\n${unreleased.description}`;
    }

    return changelog.toString();
  } catch (error) {
    console.error(error.message);
  }
}

export function generatePRLink(PRNumber) {
  return `_Full changeset and discussions: [#${PRNumber}](https://github.com/OpenTermsArchive/engine/pull/${PRNumber})._`;
}

export function checkFunder(description) {
  const quoteRegex = /^> Development of this release was(.+)$/m;

  return quoteRegex.test(description);
}

export function extractReleaseType(changelog) {
  const unreleasedRegex = /## Unreleased[ ]+\[(major|minor|patch)\]/i;
  const match = changelog.match(unreleasedRegex);

  if (match && match[1]) {
    return match[1].toLowerCase();
  }

  return null;
}
