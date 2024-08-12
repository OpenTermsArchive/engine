import { createRequire } from 'module';

import logger from '../logger/index.js';

const require = createRequire(import.meta.url);

export const MANAGED_BY_OTA_MARKER = '[managed by OTA]';

const gitlabUrl = 'https://gitlab.com/api/v4';

export default class GitLab {
  static ISSUE_STATE_CLOSED = 'closed';
  static ISSUE_STATE_OPEN = 'opened';
  static ISSUE_STATE_ALL = 'all';

  constructor(repository) {
    // const { version } = require('../../package.json');

    const [ owner, repo ] = repository.split('/');

    this.commonParams = { owner, repo };
  }

  async initialize() {
    const axios = require('axios');

    try {
      const repositoryPath = `${this.commonParams.owner}/${this.commonParams.repo}`;
      const response = await axios.get(
        `${gitlabUrl}/projects/${encodeURIComponent(repositoryPath)}`,
        { headers: { Authorization: `Bearer ${process.env.OTA_ENGINE_GITLAB_TOKEN}` } },
      );

      this.projectId = response.data.id;
    } catch (error) {
      logger.error(`🤖 Error while obtaining projectId: ${error}`);
      this.projectId = null;
    }
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
      const response = await fetch(
        `https://gitlab.com/api/v4/projects/4/labels?with_counts=true`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${process.env.OTA_ENGINE_GITLAB_TOKEN}` },
        },
      );

      if (response.status == 200) {
        const labels = response.json();

        return labels;
      }
      logger.error(`🤖 Failed to get labels: ${response.status_code} - ${response.text}`);

      return null;
    } catch (error) {
      logger.error(`🤖 Could get labels: ${error}`);
    }
  }

  async createLabel({ name, color, description }) {
    const axios = require('axios');

    try {
      const label = {
        name,
        color,
        description,
      };
      const response = await axios.post(
        `${gitlabUrl}/projects/${this.projectId}/labels`,
        label,
        {
          headers: {
            Authorization: `Bearer ${process.env.OTA_ENGINE_GITLAB_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );

      logger.info(`🤖 New label created: ${response.data.name}`);
    } catch (error) {
      logger.error(`🤖 Failed to create label: ${error}`);
    }
  }

  async createIssue({ title, description, labels }) {
    const axios = require('axios');

    try {
      const issue = {
        title,
        labels,
        description,
      };
      const response = await axios.post(
        `${gitlabUrl}/projects/${this.projectId}/issues`,
        issue,
        {
          headers: {
            Authorization: `Bearer ${process.env.OTA_ENGINE_GITLAB_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );

      logger.info(`🤖 Created GitLab issue #${response.data.iid} "${title}": ${response.data.web_url}`);

      return response;
    } catch (error) {
      logger.error(`🤖 Could not create GitLab issue "${title}": ${error}`);
    }
  }

  async setIssueLabels({ issue, labels }) {
    const axios = require('axios');

    try {
      const newLabels = { labels };
      const response = await axios.put(
        `${gitlabUrl}/projects/${this.projectId}/issues/${issue.iid}`,
        newLabels,
        {
          headers: {
            Authorization: `Bearer ${process.env.OTA_ENGINE_GITLAB_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );

      logger.debug(`response data: ${response.data}`);

      logger.info(`🤖 Updated labels to GitLab issue #${issue.iid}`);
    } catch (error) {
      logger.error(`🤖 Could not update GitLab issue #${issue.iid} "${issue.title}": ${error}`);
    }
  }

  async openIssue(issue) {
    const axios = require('axios');

    try {
      const updateIssue = { state_event: 'reopen' };
      const response = await axios.put(
        `${gitlabUrl}/projects/${this.projectId}/issues/${issue.iid}`,
        updateIssue,
        {
          headers: {
            Authorization: `Bearer ${process.env.OTA_ENGINE_GITLAB_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );

      logger.debug(`response data: ${response.data}`);

      logger.info(`🤖 Opened GitLab issue #${issue.iid}`);
    } catch (error) {
      logger.error(`🤖 Could not update GitLab issue #${issue.iid} "${issue.title}": ${error}`);
    }
  }

  async closeIssue(issue) {
    const axios = require('axios');

    try {
      const updateIssue = { state_event: 'close' };
      const response = await axios.put(
        `${gitlabUrl}/projects/${this.projectId}/issues/${issue.iid}`,
        updateIssue,
        {
          headers: {
            Authorization: `Bearer ${process.env.OTA_ENGINE_GITLAB_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );

      logger.debug(`response data: ${response.data}`);

      logger.info(`🤖 Closed GitLab issue #${issue.iid}`);
    } catch (error) {
      logger.error(`🤖 Could not update GitLab issue #${issue.iid} "${issue.title}": ${error}`);
    }
  }

  async getIssue({ title, ...searchParams }) {
    const axios = require('axios');

    try {
      let apiUrl = `${gitlabUrl}/projects/${this.projectId}/issues?state=${searchParams.state}&per_page=100`;

      if (searchParams.state == 'all') apiUrl = `${gitlabUrl}/projects/${this.projectId}/issues?per_page=100`;
      apiUrl = `${gitlabUrl}/projects/${this.projectId}/issues?search=${encodeURIComponent(title)}&per_page=100`;
      const response = await axios.get(apiUrl, { headers: { Authorization: `Bearer ${process.env.OTA_ENGINE_GITLAB_TOKEN}` } });
      const issues = response.data;

      const [issue] = issues.filter(item => item.title === title); // since only one is expected, use the first one

      setTimeout(() => {
        console.log(`${title} - ${apiUrl}`);
      }, 5000);

      return issue;
    } catch (error) {
      logger.error(`🤖 Could not find GitLab issue "${title}": ${error}`);
    }
  }

  async addCommentToIssue({ issue, comment }) {
    const axios = require('axios');
    const body = { body: comment };

    try {
      const response = await axios.post(
        `${gitlabUrl}/projects/${this.projectId}/issues/${issue.iid}/notes`,
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.OTA_ENGINE_GITLAB_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );

      logger.info(`🤖 Added comment to GitLab issue #${issue.iid} ${issue.title}: ${response.data.id}`);

      return response.data.body;
    } catch (error) {
      logger.error(`🤖 Could not add comment to GitLab issue #${issue.iid} "${issue.title}": ${error}`);
    }
  }

  async closeIssueWithCommentIfExists({ title, comment }) {
    const openedIssue = await this.getIssue({
      title,
      state: GitLab.ISSUE_STATE_OPEN,
    });

    if (!openedIssue) {
      return;
    }

    await this.addCommentToIssue({ issue: openedIssue, comment });

    return this.closeIssue(openedIssue);
  }

  async createOrUpdateIssue({ title, description, label }) {
    const issue = await this.getIssue({ title, state: GitLab.ISSUE_STATE_ALL });

    if (!issue) {
      return this.createIssue({ title, description, labels: [label] });
    }

    if (issue.state == GitLab.ISSUE_STATE_CLOSED) {
      await this.openIssue(issue);
    }

    const managedLabelsNames = this.MANAGED_LABELS.map(label => label.name);
    const [managedLabel] = issue.labels.filter(label =>
      managedLabelsNames.includes(label.name)); // it is assumed that only one specific reason for failure is possible at a time, making managed labels mutually exclusive

    if (managedLabel?.name == label) {
      // if the label is already assigned to the issue, the error is redundant with the one already reported and no further action is necessary
      return;
    }

    const labelsNotManagedToKeep = issue.labels
      .map(label => label.name)
      .filter(label => !managedLabelsNames.includes(label));

    await this.setIssueLabels({
      issue,
      labels: [ label, ...labelsNotManagedToKeep ],
    });
    await this.addCommentToIssue({ issue, comment: description });
  }
}
