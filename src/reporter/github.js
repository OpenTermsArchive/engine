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
    const { data } = await this.octokit.rest.issues.create({ ...this.commonParams, ...params }).catch(error => {
      logger.error(`🤖 Could not create GitHub issue for ${params.title}: ${error}`);
    });

    logger.info(`🤖 Created GitHub issue for ${params.title}: ${data.html_url}`);

    return data;
  }

  async updateIssue(params) {
    return this.octokit.rest.issues.update({ ...this.commonParams, ...params });
  }

  async searchIssues({ title, ...searchParams }) {
    try {
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
    } catch (error) {
      logger.error(`🤖 Could not find GitHub issue for ${title}: ${error}`);
    }
  }

  async addCommentToIssue(params) {
    const { data } = await this.octokit.rest.issues.createComment({ ...this.commonParams, ...params });

    return data;
  }
}
