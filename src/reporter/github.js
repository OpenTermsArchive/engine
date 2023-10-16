import fs from 'fs';

import { Octokit } from 'octokit';

import logger from '../logger/index.js';

const { version } = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url)).toString());

const ISSUE_STATE_CLOSED = 'closed';
const ISSUE_STATE_OPEN = 'open';
const ISSUE_STATE_ALL = 'all';

const CONTRIBUTE_URL = 'https://contribute.opentermsarchive.org/en/service';
const GOOGLE_URL = 'https://www.google.com/search?q=';

export default class GitHub {
  static isRepositoryValid(repository) {
    return repository.includes('/');
  }

  constructor(repository) {
    const [ owner, repo ] = repository.split('/');

    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
      userAgent: `opentermsarchive/${version}`,
    });
    this.commonParams = {
      owner,
      repo,
      accept: 'application/vnd.github.v3+json',
    };
  }

  async getLabels() {
    const { data } = await this.octokit.request('GET /repos/{owner}/{repo}/labels', { ...this.commonParams });

    return data;
  }

  async createLabel(params) {
    return this.octokit.request('POST /repos/{owner}/{repo}/labels', { ...this.commonParams, ...params })
      .catch(error => {
        logger.error(`Could not create label "${params.name}": ${error.toString()}`);
      });
  }

  async createIssue(params) {
    const { data } = await this.octokit.rest.issues.create({ ...this.commonParams, ...params });

    return data;
  }

  async updateIssue(params) {
    return this.octokit.rest.issues.update({ ...this.commonParams, ...params });
  }

  async searchIssues({ title, ...searchParams }) {
    const issues = await this.octokit.paginate(
      'GET /repos/{owner}/{repo}/issues',
      {
        ...this.commonParams,
        per_page: 100,
        ...searchParams,
      },
      response => response.data,
    );

    return issues.filter(item => item.title === title);
  }

  async addCommentToIssue(params) {
    const { data } = await this.octokit.rest.issues.createComment({ ...this.commonParams, ...params });

    return data;
  }

  async createIssueIfNotExists({ title, body, labels, comment }) {
    try {
      const existingIssues = await this.searchIssues({ ...this.commonParams, title, labels, state: ISSUE_STATE_ALL });

      if (!existingIssues.length) {
        const existingIssue = await this.createIssue({ ...this.commonParams, title, body, labels });

        logger.info(`🤖 Creating GitHub issue for ${title}: ${existingIssue.html_url}`);

        return;
      }

      const openedIssues = existingIssues.filter(existingIssue => existingIssue.state === ISSUE_STATE_OPEN);
      const hasNoneOpened = openedIssues.length === 0;

      for (const existingIssue of existingIssues) {
        if (hasNoneOpened) {
          try {
            /* eslint-disable no-await-in-loop */
            await this.octokit.rest.issues.update({
              ...this.commonParams,
              issue_number: existingIssue.number,
              state: ISSUE_STATE_OPEN,
            });
            await this.addCommentToIssue({
              ...this.commonParams,
              issue_number: existingIssue.number,
              body: `${comment}\n${body}`,
            });
            /* eslint-enable no-await-in-loop */
            logger.info(`🤖 Reopened automatically as an error occured for ${title}: ${existingIssue.html_url}`);
          } catch (e) {
            logger.error(`🤖 Could not update GitHub issue ${existingIssue.html_url}: ${e}`);
          }
          break;
        }
      }
    } catch (e) {
      logger.error(`🤖 Could not create GitHub issue for ${title}: ${e}`);
    }
  }

  async closeIssueIfExists({ title, comment, labels }) {
    try {
      const openedIssues = await this.searchIssues({ ...this.commonParams, title, labels, state: ISSUE_STATE_OPEN });

      for (const openedIssue of openedIssues) {
        try {
          await this.octokit.rest.issues.update({ ...this.commonParams, issue_number: openedIssue.number, state: ISSUE_STATE_CLOSED }); // eslint-disable-line no-await-in-loop
          await this.addCommentToIssue({ ...this.commonParams, issue_number: openedIssue.number, body: comment }); // eslint-disable-line no-await-in-loop
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
