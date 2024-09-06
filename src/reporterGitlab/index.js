import mime from 'mime';

import { toISODateWithoutMilliseconds } from '../archivist/utils/date.js';

import GitLab from './gitlab.js';

const CONTRIBUTION_TOOL_URL = 'https://contribute.opentermsarchive.org/';
const DOC_URL = 'https://docs.opentermsarchive.org';
const REPO_URL = process.env.OTA_ENGINE_GITLAB_BASE_URL;

const ERROR_MESSAGE_TO_ISSUE_LABEL_MAP = {
  'has no match': 'selectors',
  'HTTP code 404': 'location',
  'HTTP code 403': '403',
  'HTTP code 429': '429',
  'HTTP code 500': '500',
  'HTTP code 502': '502',
  'HTTP code 503': '503',
  'Timed out after': 'timeout',
  'getaddrinfo EAI_AGAIN': 'EAI_AGAIN',
  'getaddrinfo ENOTFOUND': 'ENOTFOUND',
  'Response is empty': 'empty response',
  'unable to verify the first certificate': 'first certificate',
  'certificate has expired': 'certificate expired',
  'maximum redirect reached': 'redirects',
};

function getLabelNameFromError(error) {
  return ERROR_MESSAGE_TO_ISSUE_LABEL_MAP[Object.keys(ERROR_MESSAGE_TO_ISSUE_LABEL_MAP).find(substring => error.toString().includes(substring))] || 'to clarify';
}

// In the following class, it is assumed that each issue is managed using its title as a unique identifier
export default class Reporter {
  constructor(config) {
    const { repositories } = config.gitlabIssues;

    for (const repositoryType of Object.keys(repositories)) {
      if (!repositories[repositoryType].includes('/') || repositories[repositoryType].includes('https://')) {
        throw new Error(`Configuration entry "reporter.gitlabIssues.repositories.${repositoryType}" is expected to be a string in the format <owner>/<repo>, but received: "${repositories[repositoryType]}"`);
      }
    }

    this.gitlab = new GitLab(repositories.declarations);
    this.repositories = repositories;
  }

  initialize() {
    return this.gitlab.initialize();
  }

  async onVersionRecorded(version) {
    await this.gitlab.closeIssueWithCommentIfExists({
      title: Reporter.generateTitleID(version.serviceId, version.termsType),
      comment: `### Tracking resumed

A new version has been recorded.`,
    });
  }

  async onVersionNotChanged(version) {
    await this.gitlab.closeIssueWithCommentIfExists({
      title: Reporter.generateTitleID(version.serviceId, version.termsType),
      comment: `### Tracking resumed

No changes were found in the last run, so no new version has been recorded.`,
    });
  }

  async onFirstVersionRecorded(version) {
    return this.onVersionRecorded(version);
  }

  async onInaccessibleContent(error, terms) {
    await this.gitlab.createOrUpdateIssue({
      title: Reporter.generateTitleID(terms.service.id, terms.type),
      description: this.generateDescription({ error, terms }),
      label: getLabelNameFromError(error),
    });
  }

  generateDescription({ error, terms }) {
    const date = new Date();
    const currentFormattedDate = date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short', timeZone: 'UTC' });
    const validUntil = toISODateWithoutMilliseconds(date);

    const hasSnapshots = terms.sourceDocuments.every(sourceDocument => sourceDocument.snapshotId);

    const contributionToolParams = new URLSearchParams({
      json: JSON.stringify(terms.toPersistence()),
      destination: this.repositories.declarations,
      step: '2',
    });
    const contributionToolUrl = `${CONTRIBUTION_TOOL_URL}?${contributionToolParams}`;

    const latestDeclarationLink = `[Latest declaration](${REPO_URL}/${this.repositories.declarations}/-/blob/main/declarations/${encodeURIComponent(terms.service.name)}.json)`;
    const latestVersionLink = `[Latest version](${REPO_URL}/${this.repositories.versions}/-/blob/main/${encodeURIComponent(terms.service.name)}/${encodeURIComponent(terms.type)}.md)`;
    const snapshotsBaseUrl = `${REPO_URL}/${this.repositories.snapshots}/-/blob/main/${encodeURIComponent(terms.service.name)}/${encodeURIComponent(terms.type)}`;
    const latestSnapshotsLink = terms.hasMultipleSourceDocuments
      ? `Latest snapshots:\n  - ${terms.sourceDocuments.map(sourceDocument => `[${sourceDocument.id}](${snapshotsBaseUrl}.%20#${sourceDocument.id}.${mime.getExtension(sourceDocument.mimeType)})`).join('\n  - ')}`
      : `[Latest snapshot](${snapshotsBaseUrl}.${mime.getExtension(terms.sourceDocuments[0].mimeType)})`;

    /* eslint-disable no-irregular-whitespace */
    return `
### No version of the \`${terms.type}\` of service \`${terms.service.name}\` is recorded anymore since ${currentFormattedDate}

The source document${terms.hasMultipleSourceDocuments ? 's have' : ' has'}${hasSnapshots ? ' ' : ' not '}been recorded in ${terms.hasMultipleSourceDocuments ? 'snapshots' : 'a snapshot'}, ${hasSnapshots ? 'but ' : 'thus '} no version can be [extracted](${DOC_URL}/#tracking-terms).
${hasSnapshots ? 'After correction, it might still be possible to recover the missed versions.' : ''}

### What went wrong

- ${error.reasons.join('\n- ')}

### How to resume tracking

First of all, check if the source documents are accessible through a web browser:

- [ ] ${terms.sourceDocuments.map(sourceDocument => `[${sourceDocument.location}](${sourceDocument.location})`).join('\n- [ ] ')}

#### If the source documents are accessible through a web browser

[Edit the declaration](${contributionToolUrl}):
- Try updating the selectors.
- Try switching client scripts on with expert mode.

#### If the source documents are not accessible anymore

- If the source documents have moved, find their new location and [update it](${contributionToolUrl}).
- If these terms have been removed, move them from the declaration to its [history file](${DOC_URL}/contributing-terms/#service-history), using \`${validUntil}\` as the \`validUntil\` value.
- If the service has closed, move the entire contents of the declaration to its [history file](${DOC_URL}/contributing-terms/#service-history), using \`${validUntil}\` as the \`validUntil\` value.

#### If none of the above works

If the source documents are accessible in a browser but fetching them always fails from the Open Terms Archive server, this is most likely because the service provider has blocked the Open Terms Archive robots from accessing its content. In this case, updating the declaration will not enable resuming tracking. Only an agreement with the service provider, an engine upgrade, or some technical workarounds provided by the administrator of this collection’s server might resume tracking.

### References

- ${latestDeclarationLink}
${this.repositories.versions ? `- ${latestVersionLink}` : ''}
${this.repositories.snapshots ? `- ${latestSnapshotsLink}` : ''} 
`;
  /* eslint-enable no-irregular-whitespace */
  }

  static generateTitleID(serviceId, type) {
    return `\`${serviceId}\` ‧ \`${type}\` ‧ not tracked anymore`;
  }
}
