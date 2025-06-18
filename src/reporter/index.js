import mime from 'mime';

import { toISODateWithoutMilliseconds } from '../archivist/utils/date.js';
import logger from '../logger/index.js';

import { createReporter } from './factory.js';

const CONTRIBUTION_TOOL_URL = 'https://contribute.opentermsarchive.org/en/service';
const DOC_URL = 'https://docs.opentermsarchive.org';

const ERROR_MESSAGE_TO_ISSUE_LABEL_MAP = {
  'has no match': 'page structure changed',
  'HTTP code 404': 'page not found',
  'HTTP code 403': 'page access forbidden',
  'HTTP code 429': 'too many requests',
  'HTTP code 500': 'server error',
  'HTTP code 502': 'invalid server response',
  'HTTP code 503': 'server unavailable',
  'Timed out after': 'page load timeout',
  EAI_AGAIN: 'DNS lookup failed',
  ENOTFOUND: 'DNS resolution failed',
  'Response is empty': 'empty response',
  'unable to verify the first certificate': 'SSL certificate invalid',
  'certificate has expired': 'SSL certificate expired',
  'maximum redirect reached': 'too many redirects',
  'not a valid selector': 'invalid selector',
  'empty content': 'empty content',
};

function getLabelNameFromError(error) {
  return ERROR_MESSAGE_TO_ISSUE_LABEL_MAP[Object.keys(ERROR_MESSAGE_TO_ISSUE_LABEL_MAP).find(substring => error.toString().includes(substring))] || 'to clarify';
}

// In the following class, it is assumed that each issue is managed using its title as a unique identifier
export default class Reporter {
  constructor(config) {
    const normalizedConfig = Reporter.normalizeConfig(config);

    Reporter.validateConfiguration(normalizedConfig.repositories);

    this.reporter = createReporter(normalizedConfig);
    this.repositories = normalizedConfig.repositories;
  }

  /**
   * Support for legacy config format where reporter configuration was nested under `githubIssues`
   * @example
   * ```json
   * {
   *   "githubIssues": {
   *     "repositories": {
   *       "declarations": "OpenTermsArchive/sandbox-declarations"
   *     }
   *   }
   * }
   * ```
   * @param   {object} config - The configuration object to normalize
   * @returns {object}        The normalized configuration object
   * @deprecated
   * @private
   */
  static normalizeConfig(config) {
    if (config.githubIssues) {
      logger.warn('The "reporter.githubIssues" key is deprecated; please see configuration documentation for the new format: https://docs.opentermsarchive.org/#configuring');

      return {
        type: 'github',
        repositories: config.githubIssues.repositories,
      };
    }

    return config;
  }

  static validateConfiguration(repositories) {
    if (!repositories?.declarations) {
      throw new Error('Required configuration key "reporter.repositories.declarations" was not found; issues on the declarations repository cannot be created');
    }

    for (const [ type, repo ] of Object.entries(repositories)) {
      if (!repo.includes('/') || repo.includes('https://')) {
        throw new Error(`Configuration entry "reporter.repositories.${type}" is expected to be a string in the format <owner>/<repo>, but received: "${repo}"`);
      }
    }
  }

  initialize() {
    return this.reporter.initialize();
  }

  onTrackingStarted() {
    return this.reporter.clearCache();
  }

  async onVersionRecorded(version) {
    await this.reporter.closeIssueWithCommentIfExists({
      title: Reporter.generateTitleID(version.serviceId, version.termsType),
      comment: `### Tracking resumed

A new version has been recorded.`,
    });
  }

  async onVersionNotChanged(version) {
    await this.reporter.closeIssueWithCommentIfExists({
      title: Reporter.generateTitleID(version.serviceId, version.termsType),
      comment: `### Tracking resumed

No changes were found in the last run, so no new version has been recorded.`,
    });
  }

  onFirstVersionRecorded(version) {
    return this.onVersionRecorded(version);
  }

  async onInaccessibleContent(error, terms) {
    await this.reporter.createOrUpdateIssue({
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

    const latestDeclarationLink = `[Latest declaration](${this.reporter.generateDeclarationURL(terms.service.name)})`;
    const latestVersionLink = `[Latest version](${this.reporter.generateVersionURL(terms.service.name, terms.type)})`;
    const snapshotsBaseUrl = this.reporter.generateSnapshotsBaseUrl(terms.service.name, terms.type);
    const latestSnapshotsLink = terms.hasMultipleSourceDocuments
      ? `Latest snapshots:\n  - ${terms.sourceDocuments.map(sourceDocument => `[${sourceDocument.id}](${snapshotsBaseUrl}.%20#${sourceDocument.id}.${mime.getExtension(sourceDocument.mimeType)})`).join('\n  - ')}`
      : `[Latest snapshot](${snapshotsBaseUrl}.${mime.getExtension(terms.sourceDocuments[0].mimeType)})`;

    /* eslint-disable no-irregular-whitespace */
    return `
### No version of the \`${terms.type}\` of service \`${terms.service.name}\` is recorded anymore since ${currentFormattedDate}

The source document${terms.hasMultipleSourceDocuments ? 's have' : ' has'}${hasSnapshots ? ' ' : ' not '}been recorded as ${terms.hasMultipleSourceDocuments ? 'snapshots' : 'a snapshot'}, ${hasSnapshots ? 'but ' : 'thus '} no version can be [extracted](${DOC_URL}/concepts/main/#tracking-terms).
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
- If these terms have been removed, move them from the declaration to its [history file](${DOC_URL}/terms/explanation/declarations-maintenance/#service-history-reference), using \`${validUntil}\` as the \`validUntil\` value.
- If the service has closed, move the entire contents of the declaration to its [history file](${DOC_URL}/contributing-terms/#service-history), using \`${validUntil}\` as the \`validUntil\` value.

#### If none of the above works

If the source documents are accessible in a browser but fetching them always fails from the Open Terms Archive server, this is most likely because the service provider has blocked the Open Terms Archive robots from accessing its content. In this case, updating the declaration will not enable resuming tracking. Only an agreement with the service provider, an engine upgrade, or some technical workarounds provided by the administrator of this collection’s server might resume tracking.

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
