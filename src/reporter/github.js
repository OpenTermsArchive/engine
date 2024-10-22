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

    this.octokit = new Octokit({
      auth: process.env.OTA_ENGINE_GITHUB_TOKEN,
      userAgent: `opentermsarchive/${version}`,
      throttle: {
        onRateLimit: () => false, // Do not retry after hitting a rate limit error
        onSecondaryRateLimit: () => false, // Do not retry after hitting a secondary rate limit error
      },
    });

    const [ owner, repo ] = repository.split('/');

    this.commonParams = { owner, repo };
  }

  async initialize() {
    this.MANAGED_LABELS = require('./labels.json');
    try {
      const existingLabels = await this.getRepositoryLabels();
      const existingLabelsNames = existingLabels.map(label => label.name);
      const missingLabels = this.MANAGED_LABELS.filter(label => !existingLabelsNames.includes(label.name));

      if (missingLabels.length) {
        logger.info(`Following required labels are not present on the repository: ${missingLabels.map(label => `"${label.name}"`).join(', ')}. Creating them…`);

        for (const label of missingLabels) {
          await this.createLabel({ /* eslint-disable-line no-await-in-loop */
            name: label.name,
            color: label.color,
            description: `${label.description} ${MANAGED_BY_OTA_MARKER}`,
          });
        }
      }
    } catch (error) {
      logger.error(`Failed to handle repository labels: ${error.message}`);
    }
  }

  async getRepositoryLabels() {
    const { data: labels } = await this.octokit.request('GET /repos/{owner}/{repo}/labels', { ...this.commonParams });

    return labels;
  }

  async createLabel({ name, color, description }) {
    await this.octokit.request('POST /repos/{owner}/{repo}/labels', {
      ...this.commonParams,
      name,
      color,
      description,
    });
  }

  async createIssue({ title, description: body, labels }) {
    const { data: issue } = await this.octokit.request('POST /repos/{owner}/{repo}/issues', {
      ...this.commonParams,
      title,
      body,
      labels,
    });

    return issue;
  }

  async updateIssue(issue, { state, labels }) {
    const { data: updatedIssue } = await this.octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
      ...this.commonParams,
      issue_number: issue.number,
      state,
      labels,
    });

    return updatedIssue;
  }

  async getIssue({ title, ...searchParams }) {
    const issues = await this.octokit.paginate('GET /repos/{owner}/{repo}/issues', {
      ...this.commonParams,
      per_page: 100,
      ...searchParams,
    }, response => response.data);

    const [issue] = issues.filter(item => item.title === title); // Since only one is expected, use the first one

    return issue;
  }

  async addCommentToIssue({ issue, comment: body }) {
    const { data: comment } = await this.octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      ...this.commonParams,
      issue_number: issue.number,
      body,
    });

    return comment;
  }

  async closeIssueWithCommentIfExists({ title, comment }) {
    try {
      const openedIssue = await this.getIssue({ title, state: GitHub.ISSUE_STATE_OPEN });

      if (!openedIssue) {
        return;
      }

      await this.addCommentToIssue({ issue: openedIssue, comment });
      logger.info(`Added comment to issue #${openedIssue.number}: ${openedIssue.html_url}`);

      await this.updateIssue(openedIssue, { state: GitHub.ISSUE_STATE_CLOSED });
      logger.info(`Closed issue #${openedIssue.number}: ${openedIssue.html_url}`);
    } catch (error) {
      logger.error(`Failed to update issue "${title}": ${error.message}`);
    }
  }

  async createOrUpdateIssue({ title, description, label }) {
    try {
      const issue = await this.getIssue({ title, state: GitHub.ISSUE_STATE_ALL });

      if (!issue) {
        const createdIssue = await this.createIssue({ title, description, labels: [label] });

        return logger.info(`Created issue #${createdIssue.number} "${title}": ${createdIssue.html_url}`);
      }

      const managedLabelsNames = this.MANAGED_LABELS.map(label => label.name);
      const labelsNotManagedToKeep = issue.labels.map(label => label.name).filter(label => !managedLabelsNames.includes(label));
      const [managedLabel] = issue.labels.filter(label => managedLabelsNames.includes(label.name)); // It is assumed that only one specific reason for failure is possible at a time, making managed labels mutually exclusive

      if (issue.state !== GitHub.ISSUE_STATE_CLOSED && managedLabel?.name === label) {
        return;
      }

      await this.updateIssue(issue, {
        state: GitHub.ISSUE_STATE_OPEN,
        labels: [ label, ...labelsNotManagedToKeep ],
      });
      logger.info(`Updated issue #${issue.number}: ${issue.html_url}`);
      await this.addCommentToIssue({ issue, comment: description });

      logger.info(`Added comment to issue #${issue.number}: ${issue.html_url}`);
    } catch (error) {
      logger.error(`Failed to update issue "${title}": ${error.message}`);
    }
  }
}
