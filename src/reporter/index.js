import fs from 'fs';

import logger from '../logger/index.js';

import GitHub from './github.js';

const CONTRIBUTE_URL = 'https://contribute.opentermsarchive.org/en/service';
const GOOGLE_URL = 'https://www.google.com/search?q=';

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
    const { repository } = config.githubIssues;

    if (!GitHub.isRepositoryValid(repository)) {
      throw new Error('reporter.githubIssues.repository should be a string with <owner>/<repo>');
    }

    this.github = new GitHub(repository);
    this.cachedIssues = {};
    this.repository = repository;
  }

  async initialize() {
    this.MANAGED_LABELS = JSON.parse(fs.readFileSync(new URL('./labels.json', import.meta.url)).toString());

    const existingLabels = await this.github.getLabels();
    const existingLabelsNames = existingLabels.map(label => label.name);
    const missingLabels = this.MANAGED_LABELS.filter(label => !existingLabelsNames.includes(label.name));

    if (missingLabels.length) {
      console.log('Following required labels are not present on the repository, let\'s create them…', missingLabels.map(label => `"${label.name}"`).join(', '));

      for (const label of missingLabels) {
        await this.github.createLabel({ /* eslint-disable-line no-await-in-loop */
          name: label.name,
          color: label.color,
          description: `${label.description} [managed by Open Terms Archive]`,
        });
      }
    }
  }

  async onVersionRecorded({ serviceId, termsType: type }) {
    await this.closeIssueIfExists({
      title: `Fix ${serviceId} - ${type}`,
      comment: '🤖 Closed automatically as data was gathered successfully',
    });
  }

  async onVersionNotChanged({ serviceId, termsType: type }) {
    await this.closeIssueIfExists({
      title: `Fix ${serviceId} - ${type}`,
      comment: '🤖 Closed automatically as version is unchanged but data has been fetched correctly',
    });
  }

  async onFirstVersionRecorded({ serviceId, termsType: type }) {
    return this.onVersionRecorded({ serviceId, termsType: type });
  }

  async onInaccessibleContent(error, terms) {
    const { title, body } = this.formatIssueTitleAndBody({ message: error.toString(), terms });

    await this.createIssueIfNotExists({
      title,
      body,
      label: Reporter.getLabelNameFromError(error),
      comment: '🤖 Reopened automatically as an error occured',
    });
  }

  async createIssueIfNotExists({ title, body, label, comment }) {
    const issue = await this.github.getIssue({ title, state: GitHub.ISSUE_STATE_ALL });

    if (!issue) {
      return this.github.createIssue({ title, body, labels: [label] });
    }

    if (issue.state == GitHub.ISSUE_STATE_CLOSED) {
      await this.github.openIssue(issue.number);
    }

    const managedLabelsNames = this.MANAGED_LABELS.map(label => label.name);
    const [labelManaged] = issue.labels.filter(label => managedLabelsNames.includes(label.name)); // it is assumed that managed labels are exclusive, allowing only one to be present at a time

    if (labelManaged?.name == label) {
      return;
    }

    const labelsNotManagedToKeep = issue.labels.filter(label => !managedLabelsNames.includes(label.name));

    await this.github.updateIssue({ issue_number: issue.number, labels: [ label, ...labelsNotManagedToKeep ] });
    await this.github.addCommentToIssue({ issue_number: issue.number, body: `${comment}\n${body}` });
  }

  async closeIssueIfExists({ title, comment }) {
    const openedIssue = await this.github.getIssue({ title, state: GitHub.ISSUE_STATE_OPEN });

    if (!openedIssue) {
      return;
    }

    await this.github.addCommentToIssue({ issue_number: openedIssue.number, body: comment });
    await this.github.closeIssue(openedIssue.number);
  }

  static getLabelNameFromError(error) {
    return ERROR_MESSAGE_TO_ISSUE_LABEL_MAP[Object.keys(ERROR_MESSAGE_TO_ISSUE_LABEL_MAP).find(substring => error.toString().includes(substring))];
  }

  formatIssueTitleAndBody({ message, terms }) {
    const { service: { name }, type } = terms;
    const json = terms.toPersistence();
    const title = `Fix ${name} - ${type}`;

    const encodedName = encodeURIComponent(name);
    const encodedType = encodeURIComponent(type);

    const urlQueryParams = new URLSearchParams({
      json: JSON.stringify(json),
      destination: this.repository,
      expertMode: 'true',
      step: '2',
    });

    const body = `
These terms are no longer tracked.

${message}

Check what's wrong by:
- Using the [online contribution tool](${CONTRIBUTE_URL}?${urlQueryParams}).
${message.includes('404') ? `- [Searching Google](${GOOGLE_URL}%22${encodedName}%22+%22${encodedType}%22) to get for a new URL.` : ''}

And some info about what has already been tracked:
- See [service declaration JSON file](https://github.com/${this.repository}/blob/main/declarations/${encodedName}.json).
`;

    return {
      title,
      body,
    };
  }
}
