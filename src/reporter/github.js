import { createRequire } from 'module';

import { Octokit } from 'octokit';

import logger from '../logger/index.js';

const require = createRequire(import.meta.url);

export const MANAGED_BY_OTA_MARKER = '[managed by OTA]';

export default class GitHub {
  static ISSUE_STATE_CLOSED = 'closed';
  static ISSUE_STATE_OPEN = 'open';
  static ISSUE_STATE_ALL = 'all';

  constructor(repository) {
    const { version } = require('../../package.json');

    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN, userAgent: `opentermsarchive/${version}` });

    const [ owner, repo ] = repository.split('/');

    this.commonParams = { owner, repo };
  }

  async initialize() {
    this.MANAGED_LABELS = require('./labels.json');

    const existingLabels = await this.getRepositoryLabels();
    const existingLabelsNames = existingLabels.map(label => label.name);
    const missingLabels = this.MANAGED_LABELS.filter(label => !existingLabelsNames.includes(label.name));

    if (missingLabels.length) {
      logger.info(`🤖 Following required labels are not present on the repository: ${missingLabels.map(label => `"${label.name}"`).join(', ')}. Creating them…`);

      for (const label of missingLabels) {
        await this.createLabel({ /* eslint-disable-line no-await-in-loop */
          name: label.name,
          color: label.color,
          description: `${label.description} ${MANAGED_BY_OTA_MARKER}`,
        });
      }
    }
  }

  async getRepositoryLabels() {
    try {
      const { data: labels } = await this.octokit.request('GET /repos/{owner}/{repo}/labels', { ...this.commonParams });

      return labels;
    } catch (error) {
      logger.error(`🤖 Could get labels: ${error}`);
    }
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

  async createIssue({ title, description: body, labels }) {
    try {
      const { data: issue } = await this.octokit.request('POST /repos/{owner}/{repo}/issues', {
        ...this.commonParams,
        title,
        body,
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

  async closeIssueWithCommentIfExists({ title, comment }) {
    const openedIssue = await this.getIssue({ title, state: GitHub.ISSUE_STATE_OPEN });

    if (!openedIssue) {
      return;
    }

    await this.addCommentToIssue({ issue: openedIssue, comment });

    return this.closeIssue(openedIssue);
  }

  async createOrUpdateIssue({ title, description, label }) {
    const issue = await this.getIssue({ title, state: GitHub.ISSUE_STATE_ALL });

    if (!issue) {
      return this.createIssue({ title, description, labels: [label] });
    }

    if (issue.state == this.ISSUE_STATE_CLOSED) {
      await this.openIssue(issue);
    }

    const managedLabelsNames = this.MANAGED_LABELS.map(label => label.name);
    const [managedLabel] = issue.labels.filter(label => managedLabelsNames.includes(label.name)); // it is assumed that only one specific reason for failure is possible at a time, making managed labels mutually exclusive

    if (managedLabel?.name == label) { // if the label is already assigned to the issue, the error is redundant with the one already reported and no further action is necessary
      return;
    }

    const labelsNotManagedToKeep = issue.labels.map(label => label.name).filter(label => !managedLabelsNames.includes(label));

    await this.setIssueLabels({ issue, labels: [ label, ...labelsNotManagedToKeep ] });
    await this.addCommentToIssue({ issue, comment: description });
  }
}
