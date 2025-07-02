import { createRequire } from 'module';

import { Octokit } from 'octokit';

import logger from '../../logger/index.js';
import { LABELS, MANAGED_BY_OTA_MARKER, DEPRECATED_MANAGED_BY_OTA_MARKER } from '../labels.js';

const require = createRequire(import.meta.url);

export default class GitHub {
  static ISSUE_STATE_CLOSED = 'closed';
  static ISSUE_STATE_OPEN = 'open';
  static ISSUE_STATE_ALL = 'all';
  static MAX_LABEL_DESCRIPTION_LENGTH = 100;

  constructor(repository) {
    const { version } = require('../../../package.json');

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

    this.issuesCache = new Map();
    this._issuesPromise = null;
  }

  get issues() {
    if (!this._issuesPromise) {
      logger.info('Loading issues from GitHub…');
      this._issuesPromise = this.loadAllIssues();
    }

    return this._issuesPromise;
  }

  clearCache() {
    this.issuesCache.clear();
    this._issuesPromise = null;
    logger.info('Issues cache cleared');
  }

  async initialize() {
    this.MANAGED_LABELS = Object.values(LABELS);
    try {
      const existingLabels = await this.getRepositoryLabels();
      const labelsToRemove = existingLabels.filter(label => label.description && label.description.includes(DEPRECATED_MANAGED_BY_OTA_MARKER));

      if (labelsToRemove.length) {
        logger.info(`Removing labels with deprecated markers: ${labelsToRemove.map(label => `"${label.name}"`).join(', ')}`);

        for (const label of labelsToRemove) {
          await this.deleteLabel(label.name); /* eslint-disable-line no-await-in-loop */
        }
      }

      const updatedExistingLabels = labelsToRemove.length ? await this.getRepositoryLabels() : existingLabels; // Refresh labels after deletion, only if needed
      const existingLabelsNames = updatedExistingLabels.map(label => label.name);
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

  async loadAllIssues() {
    try {
      const issues = await this.octokit.paginate('GET /repos/{owner}/{repo}/issues', {
        ...this.commonParams,
        state: GitHub.ISSUE_STATE_ALL,
        per_page: 100,
      });

      const onlyIssues = issues.filter(issue => !issue.pull_request); // Filter out pull requests since GitHub treats them as a special type of issue

      onlyIssues.forEach(issue => {
        const cachedIssue = this.issuesCache.get(issue.title);

        if (!cachedIssue || new Date(issue.created_at) < new Date(cachedIssue.created_at)) { // Only work on the oldest issue if there are duplicates, in order to consolidate the longest history possible
          this.issuesCache.set(issue.title, issue);
        }
      });

      logger.info(`Cached ${onlyIssues.length} issues from the GitHub repository`);

      return this.issuesCache;
    } catch (error) {
      logger.error(`Failed to load issues: ${error.message}`);
      throw error;
    }
  }

  async getRepositoryLabels() {
    const labels = await this.octokit.paginate('GET /repos/{owner}/{repo}/labels', {
      ...this.commonParams,
      per_page: 100,
    });

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

  async deleteLabel(name) {
    await this.octokit.request('DELETE /repos/{owner}/{repo}/labels/{name}', {
      ...this.commonParams,
      name,
    });
  }

  async getIssue(title) {
    return (await this.issues).get(title);
  }

  async createIssue({ title, description: body, labels }) {
    const { data: issue } = await this.octokit.request('POST /repos/{owner}/{repo}/issues', {
      ...this.commonParams,
      title,
      body,
      labels,
    });

    this.issuesCache.set(issue.title, issue);

    return issue;
  }

  async updateIssue(issue, { state, labels }) {
    const { data: updatedIssue } = await this.octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
      ...this.commonParams,
      issue_number: issue.number,
      state,
      labels,
    });

    this.issuesCache.set(updatedIssue.title, updatedIssue);

    return updatedIssue;
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
      const issue = await this.getIssue(title);

      if (!issue || issue.state == GitHub.ISSUE_STATE_CLOSED) {
        return;
      }

      await this.addCommentToIssue({ issue, comment });

      const updatedIssue = await this.updateIssue(issue, { state: GitHub.ISSUE_STATE_CLOSED });

      logger.info(`Closed issue with comment #${updatedIssue.number}: ${updatedIssue.html_url}`);
    } catch (error) {
      logger.error(`Failed to close issue with comment "${title}": ${error.stack}`);
    }
  }

  async createOrUpdateIssue({ title, description, labels }) {
    try {
      const issue = await this.getIssue(title);

      if (!issue) {
        const createdIssue = await this.createIssue({ title, description, labels });

        return logger.info(`Created issue #${createdIssue.number} "${title}": ${createdIssue.html_url}`);
      }

      const managedLabelsNames = this.MANAGED_LABELS.map(label => label.name);
      const labelsNotManagedToKeep = issue.labels.map(label => label.name).filter(label => !managedLabelsNames.includes(label));
      const managedLabels = issue.labels.filter(label => managedLabelsNames.includes(label.name));

      if (issue.state !== GitHub.ISSUE_STATE_CLOSED && labels.every(label => managedLabels.some(managedLabel => managedLabel.name === label))) {
        return; // if all requested labels are already assigned to the issue, the error is redundant with the one already reported and no further action is necessary
      }

      const updatedIssue = await this.updateIssue(issue, { state: GitHub.ISSUE_STATE_OPEN, labels: [ ...labels, ...labelsNotManagedToKeep ] });

      await this.addCommentToIssue({ issue, comment: description });

      logger.info(`Updated issue with comment #${updatedIssue.number}: ${updatedIssue.html_url}`);
    } catch (error) {
      logger.error(`Failed to update issue "${title}": ${error.stack}`);
    }
  }

  generateDeclarationURL(serviceName) {
    return `https://github.com/${this.commonParams.owner}/${this.commonParams.repo}/blob/main/declarations/${encodeURIComponent(serviceName)}.json`;
  }

  generateVersionURL(serviceName, termsType) {
    return `https://github.com/${this.commonParams.owner}/${this.commonParams.repo}/blob/main/${encodeURIComponent(serviceName)}/${encodeURIComponent(termsType)}.md`;
  }

  generateSnapshotsBaseUrl(serviceName, termsType) {
    return `https://github.com/${this.commonParams.owner}/${this.commonParams.repo}/blob/main/${encodeURIComponent(serviceName)}/${encodeURIComponent(termsType)}`;
  }
}
