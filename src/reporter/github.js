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

    this.issuesCache = new Map();
    this.cacheLoadedPromise = null;
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

      logger.info(`Cached ${onlyIssues.length} issues from the repository`);
    } catch (error) {
      logger.error(`Failed to load issues: ${error.message}`);
    }
  }

  async refreshIssuesCache() {
    try {
      logger.info('Refreshing issues cache from GitHub…');
      this.issuesCache.clear();
      this.cacheLoadedPromise = this.loadAllIssues();
      await this.cacheLoadedPromise;
      logger.info('Issues cache refreshed successfully');
    } catch (error) {
      logger.error(`Failed to refresh issues cache: ${error.message}`);
    }
  }

  async ensureCacheLoaded() {
    if (!this.cacheLoadedPromise) {
      this.cacheLoadedPromise = this.loadAllIssues();
    }
    await this.cacheLoadedPromise;
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
    await this.ensureCacheLoaded();

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
    await this.ensureCacheLoaded();

    const { data: updatedIssue } = await this.octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
      ...this.commonParams,
      issue_number: issue.number,
      state,
      labels,
    });

    this.issuesCache.set(updatedIssue.title, updatedIssue);

    return updatedIssue;
  }

  getIssue(title) {
    return this.issuesCache.get(title) || null;
  }

  async addCommentToIssue({ issue, comment: body }) {
    await this.ensureCacheLoaded();

    const { data: comment } = await this.octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      ...this.commonParams,
      issue_number: issue.number,
      body,
    });

    return comment;
  }

  async closeIssueWithCommentIfExists({ title, comment }) {
    try {
      await this.ensureCacheLoaded();

      const issue = this.getIssue(title);

      if (!issue || issue.state == GitHub.ISSUE_STATE_CLOSED) {
        return;
      }

      await this.addCommentToIssue({ issue, comment });

      const updatedIssue = await this.updateIssue(issue, { state: GitHub.ISSUE_STATE_CLOSED });

      this.issuesCache.set(updatedIssue.title, updatedIssue);
      logger.info(`Closed issue with comment #${updatedIssue.number}: ${updatedIssue.html_url}`);
    } catch (error) {
      logger.error(`Failed to close issue with comment "${title}": ${error.stack}`);
    }
  }

  async createOrUpdateIssue({ title, description, label }) {
    try {
      await this.ensureCacheLoaded();

      const issue = this.getIssue(title);

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

      const updatedIssue = await this.updateIssue(issue, { state: GitHub.ISSUE_STATE_OPEN, labels: [ label, ...labelsNotManagedToKeep ].filter(label => label) });

      await this.addCommentToIssue({ issue, comment: description });

      this.issuesCache.set(updatedIssue.title, updatedIssue);
      logger.info(`Updated issue with comment #${updatedIssue.number}: ${updatedIssue.html_url}`);
    } catch (error) {
      logger.error(`Failed to update issue "${title}": ${error.stack}`);
    }
  }
}
