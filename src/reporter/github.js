import fs from 'fs';

import { Octokit } from 'octokit';

import logger from '../logger/index.js';

export default class GitHub {
  static ISSUE_STATE_CLOSED = 'closed';
  static ISSUE_STATE_OPEN = 'open';
  static ISSUE_STATE_ALL = 'all';

  constructor(repository) {
    const { version } = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url)).toString());

    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN, userAgent: `opentermsarchive/${version}` });

    const [ owner, repo ] = repository.split('/');

    this.commonParams = { owner, repo };
  }

  async initialize() {
    const { data: user } = await this.octokit.request('GET /user', { ...this.commonParams });

    this.authenticatedUserLogin = user.login;
  }

  async getRepositoryLabels() {
    const { data: labels } = await this.octokit.request('GET /repos/{owner}/{repo}/labels', { ...this.commonParams });

    return labels;
  }

  async createLabel({ name, color, description }) {
    try {
      await this.octokit.request('POST /repos/{owner}/{repo}/labels', {
        ...this.commonParams,
        name,
        color,
        description,
      });

      logger.info(`🤖 Created repository label "${name}"`);
    } catch (error) {
      logger.error(`🤖 Could not create label "${name}": ${error}`);
    }
  }

  async createIssue({ title, description, labels }) {
    try {
      const { data: issue } = await this.octokit.request('POST /repos/{owner}/{repo}/issues', {
        ...this.commonParams,
        title,
        description,
        labels,
      });

      logger.info(`🤖 Created GitHub issue #${issue.number} "${title}": ${issue.html_url}`);

      return issue;
    } catch (error) {
      logger.error(`🤖 Could not create GitHub issue "${title}": ${error}`);
    }
  }

  async setIssueLabels({ issue, labels }) {
    try {
      await this.octokit.request('PUT /repos/{owner}/{repo}/issues/{issue_number}/labels', {
        ...this.commonParams,
        issue_number: issue.number,
        labels,
      });

      logger.info(`🤖 Updated labels to GitHub issue #${issue.number}`);
    } catch (error) {
      logger.error(`🤖 Could not update GitHub issue #${issue.number} "${issue.title}": ${error}`);
    }
  }

  async openIssue(issue) {
    try {
      await this.octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
        ...this.commonParams,
        issue_number: issue.number,
        state: GitHub.ISSUE_STATE_OPEN,
      });

      logger.info(`🤖 Opened GitHub issue #${issue.number}`);
    } catch (error) {
      logger.error(`🤖 Could not update GitHub issue #${issue.number} "${issue.title}": ${error}`);
    }
  }

  async closeIssue(issue) {
    try {
      await this.octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
        ...this.commonParams,
        issue_number: issue.number,
        state: GitHub.ISSUE_STATE_CLOSED,
      });

      logger.info(`🤖 Closed GitHub issue #${issue.number}`);
    } catch (error) {
      logger.error(`🤖 Could not update GitHub issue #${issue.number} "${issue.title}": ${error}`);
    }
  }

  async getIssue({ title, ...searchParams }) {
    try {
      const issues = await this.octokit.paginate('GET /repos/{owner}/{repo}/issues', {
        ...this.commonParams,
        per_page: 100,
        creator: this.authenticatedUserLogin,
        ...searchParams,
      }, response => response.data);

      const [issue] = issues.filter(item => item.title === title); // since only one is expected, use the first one

      return issue;
    } catch (error) {
      logger.error(`🤖 Could not find GitHub issue "${title}": ${error}`);
    }
  }

  async addCommentToIssue({ issue, comment: body }) {
    try {
      const { data: comment } = await this.octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        ...this.commonParams,
        issue_number: issue.number,
        body,
      });

      logger.info(`🤖 Added comment to GitHub issue #${issue.number}: ${comment.html_url}`);

      return comment;
    } catch (error) {
      logger.error(`🤖 Could not add comment to GitHub issue #${issue.number} "${issue.title}": ${error}`);
    }
  }
}
