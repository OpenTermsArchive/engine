import fs from 'fs';

import { Octokit } from 'octokit';

import logger from '../logger/index.js';

const { version } = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url)).toString());

export default class GitHub {
  static ISSUE_STATE_CLOSED = 'closed';

  static ISSUE_STATE_OPEN = 'open';

  static ISSUE_STATE_ALL = 'all';

  static isRepositoryValid(repository) {
    return repository.includes('/');
  }

  constructor(repository) {
    const [ owner, repo ] = repository.split('/');

    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN, userAgent: `opentermsarchive/${version}` });
    this.commonParams = {
      owner,
      repo,
    };
  }

  async getRepositoryLabels() {
    const { data } = await this.octokit.request('GET /repos/{owner}/{repo}/labels', { ...this.commonParams });

    return data;
  }

  async createLabel(params) {
    try {
      await this.octokit.request('POST /repos/{owner}/{repo}/labels', { ...this.commonParams, ...params });

      logger.info(`🤖 Created repository label "${params.name}"`);
    } catch (error) {
      logger.error(`🤖 Could not create label "${params.name}": ${error.toString()}`);
    }
  }

  async createIssue(params) {
    try {
      const { data } = await this.octokit.request('POST /repos/{owner}/{repo}/issues', { ...this.commonParams, ...params });

      logger.info(`🤖 Created GitHub issue "${params.title}": ${data.html_url}`);

      return data;
    } catch (error) {
      logger.error(`🤖 Could not create GitHub issue "${params.title}": ${error}`);
    }
  }

  async setIssueLabels({ issue, labels }) {
    try {
      await this.octokit.request('PUT /repos/{owner}/{repo}/issues/{issue_number}/labels', {
        ...this.commonParams,
        issue_number: issue.number,
        labels,
      });

      logger.info(`🤖 Updated GitHub issue labels "${issue.title}"`);
    } catch (error) {
      logger.error(`🤖 Could not update GitHub issue "${issue.title}": ${error}`);
    }
  }

  async openIssue(issue) {
    try {
      await this.octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
        ...this.commonParams,
        issue_number: issue.number,
        state: GitHub.ISSUE_STATE_OPEN,
      });

      logger.info(`🤖 Opened GitHub issue "${issue.title}": ${issue.html_url}`);
    } catch (error) {
      logger.error(`🤖 Could not update GitHub issue "${issue.title}": ${error}`);
    }
  }

  async closeIssue(issue) {
    try {
      await this.octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
        ...this.commonParams,
        issue_number: issue.number,
        state: GitHub.ISSUE_STATE_CLOSED,
      });

      logger.info(`🤖 Closed GitHub issue "${issue.title}": ${issue.html_url}`);
    } catch (error) {
      logger.error(`🤖 Could not update GitHub issue "${issue.title}": ${error}`);
    }
  }

  async getIssue({ title, ...searchParams }) {
    try {
      const issues = await this.octokit.paginate('GET /repos/{owner}/{repo}/issues', {
        ...this.commonParams,
        per_page: 100,
        ...searchParams,
      }, response => response.data);

      const [issue] = issues.filter(item => item.title === title); // since only one is expected, utilize the first one

      return issue;
    } catch (error) {
      logger.error(`🤖 Could not find GitHub issue "${title}": ${error}`);
    }
  }

  async addCommentToIssue({ issue, comment }) {
    try {
      const { data } = await this.octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        ...this.commonParams,
        issue_number: issue.number,
        body: comment,
      });

      logger.info(`🤖 Add comment to GitHub issue "${issue.title}": ${data.html_url}`);

      return data;
    } catch (error) {
      logger.error(`🤖 Could not add comment to GitHub issue "${issue.title}": ${error}`);
    }
  }
}
