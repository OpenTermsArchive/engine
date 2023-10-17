import fs from 'fs';

import mime from 'mime';

import GitHub from './github.js';

const CONTRIBUTE_URL = 'https://contribute.opentermsarchive.org/en/service';
const DOC_URL = 'https://docs.opentermsarchive.org';

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
  'Response is empty': 'empty response',
  'unable to verify the first certificate': 'first certificate',
  'certificate has expired': 'certificate expired',
  'maximum redirect reached': 'redirects',
};

// In the following class, it is assumed that each issue is managed using its name as a unique identifier
export default class Reporter {
  constructor(config) {
    const { repositories } = config.githubIssues;

    for (const repositoryType of Object.keys(repositories)) {
      if (!GitHub.isRepositoryValid(repositories[repositoryType])) {
        throw new Error(`Configuration entry "reporter.githubIssues.repositories.${repositoryType}" is expected to be a string in the format <owner>/<repo>, but received: ${repositories[repositoryType]}`);
      }
    }

    this.github = new GitHub(repositories.declarations);
    this.cachedIssues = {};
    this.repositories = repositories;
  }

  async initialize() {
    this.MANAGED_LABELS = JSON.parse(fs.readFileSync(new URL('./labels.json', import.meta.url)).toString());

    const existingLabels = await this.github.getRepositoryLabels();
    const existingLabelsNames = existingLabels.map(label => label.name);
    const missingLabels = this.MANAGED_LABELS.filter(label => !existingLabelsNames.includes(label.name));

    if (missingLabels.length) {
      console.log(`Following required labels are not present on the repository: ${missingLabels.map(label => `"${label.name}"`).join(', ')}. Creating them…`);

      for (const label of missingLabels) {
        await this.github.createLabel({ /* eslint-disable-line no-await-in-loop */
          name: label.name,
          color: label.color,
          description: `${label.description} [managed by Open Terms Archive]`,
        });
      }
    }
  }

  async onVersionRecorded(version) {
    await this.closeIssueIfExists({
      title: Reporter.generateTitleID(version.serviceId, version.termsType),
      comment: 'Closed automatically as data was gathered successfully',
    });
  }

  async onVersionNotChanged(version) {
    await this.closeIssueIfExists({
      title: Reporter.generateTitleID(version.serviceId, version.termsType),
      comment: 'Closed automatically as version is unchanged but data has been fetched correctly',
    });
  }

  async onFirstVersionRecorded(version) {
    return this.onVersionRecorded(version);
  }

  async onInaccessibleContent(error, terms) {
    await this.createOrUpdateIssue({
      title: Reporter.generateTitleID(terms.service.id, terms.type),
      body: this.generateDescription({ error, terms, hasSnapshot: true }),
      label: Reporter.getLabelNameFromError(error),
    });
  }

  async createOrUpdateIssue({ title, body, label }) {
    const issue = await this.github.getIssue({ title, state: GitHub.ISSUE_STATE_ALL });

    if (!issue) {
      return this.github.createIssue({ title, body, labels: [label] });
    }

    if (issue.state == GitHub.ISSUE_STATE_CLOSED) {
      await this.github.openIssue(issue);
    }

    const managedLabelsNames = this.MANAGED_LABELS.map(label => label.name);
    const [labelManaged] = issue.labels.filter(label => managedLabelsNames.includes(label.name)); // it is assumed that managed labels are exclusive, allowing only one to be present at a time

    if (labelManaged?.name == label) { // if the label is already assigned to the issue, the error is redundant with the one already reported and no further action is necessary
      return;
    }

    const labelsNotManagedToKeep = issue.labels.map(label => label.name).filter(label => !managedLabelsNames.includes(label));

    await this.github.setIssueLabels({ issue, labels: [ label, ...labelsNotManagedToKeep ] });
    await this.github.addCommentToIssue({ issue, comment: `Updated automatically as an error occured\n- - -\n${body}` });
  }

  async closeIssueIfExists({ title, comment }) {
    const openedIssue = await this.github.getIssue({ title, state: GitHub.ISSUE_STATE_OPEN });

    if (!openedIssue) {
      return;
    }

    await this.github.addCommentToIssue({ issue: openedIssue, comment });
    await this.github.closeIssue(openedIssue);
  }

  generateDescription({ error, terms }) {
    const currentFormattedDate = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    const hasSnapshot = Boolean(!terms.sourceDocuments.find(sourceDocument => !sourceDocument.snapshotId));
    const urlQueryParams = new URLSearchParams({
      json: JSON.stringify(terms.toPersistence()),
      destination: this.repositories.declarations,
      expertMode: 'true',
      step: '2',
    });
    const contributionToolUrl = `${CONTRIBUTE_URL}?${urlQueryParams}`;
    const latestDeclaration = `- [Latest declaration](https://github.com/${this.repositories.declarations}/blob/main/declarations/${encodeURIComponent(terms.service.name)}.json)`;
    const latestVersion = `- [Latest version](https://github.com/${this.repositories.versions}/blob/main/${encodeURIComponent(terms.service.name)}/${encodeURIComponent(terms.type)}.md)`;
    const latestSnapshotBaseUrl = `https://github.com/${this.repositories.snapshots}/blob/main/${encodeURIComponent(terms.service.name)}/${encodeURIComponent(terms.type)}`;
    const latestSnapshots = terms.hasMultipleSourceDocuments
      ? `- Latest snapshots:\n  - ${terms.sourceDocuments.map(sourceDocument => `[${sourceDocument.id}](${latestSnapshotBaseUrl}.%20#${sourceDocument.id}.${mime.getExtension(sourceDocument.mimeType)})`).join('\n  - ')}`
      : `- [Latest snapshot](${latestSnapshotBaseUrl}.${mime.getExtension(terms.sourceDocuments[0].mimeType)})`;

    return `
## No version of the \`${terms.type}\` of service \`${terms.service.name}\` is recorded anymore since ${currentFormattedDate}

The source document${terms.hasMultipleSourceDocuments ? 's have' : ' has'}${hasSnapshot ? ' ' : ' not '}been recorded in a snapshot, ${hasSnapshot ? 'but ' : 'thus '} [no version can be extracted](https://docs.opentermsarchive.org/#tracking-terms).
${hasSnapshot ? 'After correction, it might still be possible to recover the missed versions.' : ''}

### What went wrong

- \`${error.reasons.join('`\n- `')}\`

### How to resume tracking

First of all, check if the source documents are accessible through a web browser:

- [ ] ${terms.sourceDocuments.map(sourceDocument => `[${sourceDocument.location}](${sourceDocument.location})`).join('\n- [ ] ')}

#### If the source documents are accessible through a web browser

- Try [updating the selectors](${contributionToolUrl}).
- Try [switching client scripts on](${contributionToolUrl}).

#### If the source documents are not accessible anymore

- If the source documents have moved, find their new location and [update it](${contributionToolUrl}).
- If these terms have been removed, move them from the declaration to its [history file](${DOC_URL}/contributing-terms/#service-history), using the date of this report as the \`validUntil\` value.
- If the service has closed, move the entire contents of the declaration to its [history file](${DOC_URL}/contributing-terms/#service-history), using the date of this report as the \`validUntil\` value.

#### If none of the above works

If the source documents are accessible in a browser but fetching them always fails from the Open Terms Archive server, this is most likely because the service provider has blocked the Open Terms Archive robots from accessing its content. In this case, updating the declaration will not enable resuming tracking. Only an agreement with the service provider, an engine upgrade, or some technical workarounds provided by the administrator of this collection’s server might resume tracking.

### References

${latestDeclaration}
${latestVersion}
${hasSnapshot ? latestSnapshots : ''}
`;
  }

  static getLabelNameFromError(error) {
    return ERROR_MESSAGE_TO_ISSUE_LABEL_MAP[Object.keys(ERROR_MESSAGE_TO_ISSUE_LABEL_MAP).find(substring => error.toString().includes(substring))];
  }

  static generateTitleID(serviceId, type) {
    return `\`${serviceId}\` ‧ \`${type}\` ‧ not tracked anymore`;
  }
}
