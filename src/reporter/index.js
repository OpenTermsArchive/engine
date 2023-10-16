import fs from 'fs';

import logger from '../logger/index.js';

import GitHub from './github.js';

const ISSUE_STATE_CLOSED = 'closed';
const ISSUE_STATE_OPEN = 'open';
const ISSUE_STATE_ALL = 'all';

const CONTRIBUTE_URL = 'https://contribute.opentermsarchive.org/en/service';
const GOOGLE_URL = 'https://www.google.com/search?q=';

export default class Reporter {
  constructor(config) {
    const { repository, label } = config.githubIssues;

    if (!GitHub.isRepositoryValid(repository)) {
      throw new Error('reporter.githubIssues.repository should be a string with <owner>/<repo>');
    }

    this.github = new GitHub(repository);
    this.cachedIssues = {};
    this.repository = repository;
    this.label = label;
  }

  async initialize() {
    await this.github.createLabel({ /* eslint-disable-line no-await-in-loop */
      name: this.label.name,
      color: this.label.color,
      description: this.label.description,
    });
  }

  async onVersionRecorded({ serviceId, termsType: type }) {
    await this.closeIssueIfExists({
      labels: [this.label.name],
      title: `Fix ${serviceId} - ${type}`,
      comment: '🤖 Closed automatically as data was gathered successfully',
    });
  }

  async onVersionNotChanged({ serviceId, termsType: type }) {
    await this.closeIssueIfExists({
      labels: [this.label.name],
      title: `Fix ${serviceId} - ${type}`,
      comment: '🤖 Closed automatically as version is unchanged but data has been fetched correctly',
    });
  }

  async onFirstVersionRecorded({ serviceId, termsType: type }) {
    return this.onVersionRecorded({ serviceId, termsType: type });
  }

  async onInaccessibleContent(error, terms) {
    const { title, body } = Reporter.formatIssueTitleAndBody({ message: error.toString(), repository: this.repository, terms });

    await this.createIssueIfNotExists({
      title,
      body,
      labels: [this.label.name],
      comment: '🤖 Reopened automatically as an error occured',
    });
  }

  async createIssueIfNotExists({ title, body, labels, comment }) {
    const existingIssues = await this.github.searchIssues({ title, labels, state: ISSUE_STATE_ALL }).catch(error => {
      logger.error(`🤖 Could not find GitHub issue for ${title}: ${error}`);
    });

    if (!existingIssues?.length) {
      try {
        const existingIssue = await this.github.createIssue({ title, body, labels });

        logger.info(`🤖 Creating GitHub issue for ${title}: ${existingIssue.html_url}`);

        return;
      } catch (e) {
        logger.error(`🤖 Could not create GitHub issue for ${title}: ${e}`);
      }
    }

    const openedIssues = existingIssues.filter(existingIssue => existingIssue.state === ISSUE_STATE_OPEN);

    const hasNoneOpened = openedIssues.length === 0;

    for (const existingIssue of existingIssues) {
      if (hasNoneOpened) {
        try {
          await this.github.updateIssue({ issue_number: existingIssue.number, state: ISSUE_STATE_OPEN }); // eslint-disable-line no-await-in-loop
          await this.github.addCommentToIssue({ issue_number: existingIssue.number, body: `${comment}\n${body}` }); // eslint-disable-line no-await-in-loop
          logger.info(`🤖 Reopened automatically as an error occured for ${title}: ${existingIssue.html_url}`);
        } catch (e) {
          logger.error(`🤖 Could not update GitHub issue ${existingIssue.html_url}: ${e}`);
        }
        break;
      }
    }
  }

  async closeIssueIfExists({ title, comment, labels }) {
    try {
      const openedIssues = await this.github.searchIssues({ title, labels, state: ISSUE_STATE_OPEN });

      for (const openedIssue of openedIssues) {
        try {
          await this.github.update({ issue_number: openedIssue.number, state: ISSUE_STATE_CLOSED }); // eslint-disable-line no-await-in-loop
          await this.github.addCommentToIssue({ issue_number: openedIssue.number, body: comment }); // eslint-disable-line no-await-in-loop
          logger.info(`🤖 GitHub issue closed for ${title}: ${openedIssue.html_url}`);
        } catch (e) {
          logger.error(`🤖 Could not close GitHub issue ${openedIssue.html_url}: ${e.toString()}`);
        }
      }
    } catch (e) {
      logger.error(`🤖 Could not close GitHub issue for ${title}: ${e}`);
    }
  }

  static formatIssueTitleAndBody({ message, repository, terms }) {
    const { service: { name }, type } = terms;
    const json = terms.toPersistence();
    const title = `Fix ${name} - ${type}`;

    const encodedName = encodeURIComponent(name);
    const encodedType = encodeURIComponent(type);

    const urlQueryParams = new URLSearchParams({
      json: JSON.stringify(json),
      destination: repository,
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
- See [service declaration JSON file](https://github.com/${repository}/blob/main/declarations/${encodedName}.json).
`;

    return {
      title,
      body,
    };
  }
}
