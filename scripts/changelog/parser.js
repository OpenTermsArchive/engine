import { parser as keepAChangelogParser } from 'keep-a-changelog';

export function parser(changelogContent) {
  const changelog = keepAChangelogParser(changelogContent);

  changelog.format = 'markdownlint';

  const unreleasedType = extractReleaseType(changelogContent);

  changelog.unreleasedRegex = unreleasedType;

  return changelog;
}

export function extractReleaseType(changelogContent) {
  const unreleasedRegex = /## Unreleased[ ]+\[(major|minor|patch)\]/i;
  const match = changelogContent.match(unreleasedRegex);

  if (match && match[1]) {
    return match[1].toLowerCase();
  }

  return null;
}
