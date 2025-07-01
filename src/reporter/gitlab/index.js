import HttpProxyAgent from 'http-proxy-agent';
import HttpsProxyAgent from 'https-proxy-agent';
import nodeFetch from 'node-fetch';

import logger from '../../logger/index.js';
import { LABELS, MANAGED_BY_OTA_MARKER, DEPRECATED_MANAGED_BY_OTA_MARKER } from '../labels.js';

const BASE_URL = 'https://gitlab.com';
const API_BASE_URL = 'https://gitlab.com/api/v4';

export default class GitLab {
  static ISSUE_STATE_CLOSED = 'closed';
  static ISSUE_STATE_OPEN = 'opened';
  static ISSUE_STATE_ALL = 'all';
  static MAX_LABEL_DESCRIPTION_LENGTH = 255;

  constructor(repository, baseURL = BASE_URL, apiBaseURL = API_BASE_URL) {
    this.repositoryPath = repository;
    this.projectId = null;
    this.baseURL = baseURL;
    this.apiBaseURL = apiBaseURL;
  }

  async initialize() {
    const options = GitLab.baseOptionsHttpReq();

    try {
      const response = await nodeFetch(
        `${this.apiBaseURL}/projects/${encodeURIComponent(this.repositoryPath)}`,
        options,
      );

      const res = await response.json();

      if (response.ok) {
        this.projectId = res.id;
      } else {
        logger.error(`Error while obtaining projectId: ${JSON.stringify(res)}`);
        this.projectId = null;
      }
    } catch (error) {
      logger.error(`Error while obtaining projectId: ${error}`);
      this.projectId = null;
    }

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

      const existingLabelsNames = existingLabels.map(label => label.name);
      const missingLabels = this.MANAGED_LABELS.filter(label => !existingLabelsNames.includes(label.name));

      if (missingLabels.length) {
        logger.info(`Following required labels are not present on the repository: ${missingLabels.map(label => `"${label.name}"`).join(', ')}. Creating them…`);

        for (const label of missingLabels) {
          await this.createLabel({ /* eslint-disable-line no-await-in-loop */
            name: label.name,
            color: `#${label.color}`,
            description: `${label.description} ${MANAGED_BY_OTA_MARKER}`,
          });
        }
      }
    } catch (error) {
      logger.error(`Failed to handle repository labels: ${error.message}`);
    }
  }

  async getRepositoryLabels() {
    try {
      const options = GitLab.baseOptionsHttpReq();
      const response = await nodeFetch(
        `${this.apiBaseURL}/projects/${this.projectId}/labels?with_counts=true`,
        options,
      );

      const res = await response.json();

      if (response.ok) {
        return res;
      }

      logger.error(`Failed to get labels: ${response.status} - ${JSON.stringify(res)}`);

      return null;
    } catch (error) {
      logger.error(`Could not get labels: ${error}`);
    }
  }

  async createLabel({ name, color, description }) {
    try {
      const label = {
        name,
        color,
        description,
      };

      const options = GitLab.baseOptionsHttpReq();

      options.method = 'POST';
      options.body = JSON.stringify(label);
      options.headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      const response = await nodeFetch(
        `${this.apiBaseURL}/projects/${this.projectId}/labels`,
        options,
      );

      const res = await response.json();

      if (response.ok) {
        logger.info(`New label created: ${res.name} , color: ${res.color}`);
      } else {
        logger.error(`createLabel response: ${JSON.stringify(res)}`);
      }
    } catch (error) {
      logger.error(`Failed to create label: ${error}`);
    }
  }

  async deleteLabel(name) {
    try {
      const options = GitLab.baseOptionsHttpReq();

      options.method = 'DELETE';

      const response = await nodeFetch(
        `${this.apiBaseURL}/projects/${this.projectId}/labels/${encodeURIComponent(name)}`,
        options,
      );

      if (response.ok) {
        logger.info(`Label deleted: ${name}`);
      } else {
        const res = await response.json();

        logger.error(`deleteLabel response: ${JSON.stringify(res)}`);
      }
    } catch (error) {
      logger.error(`Failed to delete label: ${error}`);
    }
  }

  async createIssue({ title, description, labels }) {
    try {
      const issue = {
        title,
        labels,
        description,
      };

      const options = GitLab.baseOptionsHttpReq();

      options.method = 'POST';
      options.body = JSON.stringify(issue);
      options.headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      const response = await nodeFetch(
        `${this.apiBaseURL}/projects/${this.projectId}/issues`,
        options,
      );

      const res = await response.json();

      if (response.ok) {
        logger.info(`Created GitLab issue #${res.iid} "${title}": ${res.web_url}`);

        return res;
      }

      logger.error(`createIssue response: ${JSON.stringify(res)}`);
    } catch (error) {
      logger.error(`Could not create GitLab issue "${title}": ${error}`);
    }
  }

  async setIssueLabels({ issue, labels }) {
    const newLabels = { labels };
    const options = GitLab.baseOptionsHttpReq();

    options.method = 'PUT';
    options.body = JSON.stringify(newLabels);
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await nodeFetch(
        `${this.apiBaseURL}/projects/${this.projectId}/issues/${issue.iid}`,
        options,
      );

      const res = await response.json();

      if (response.ok) {
        logger.info(`Updated labels to GitLab issue #${issue.iid}`);
      } else {
        logger.error(`setIssueLabels response: ${JSON.stringify(res)}`);
      }
    } catch (error) {
      logger.error(`Could not update GitLab issue #${issue.iid} "${issue.title}": ${error}`);
    }
  }

  async openIssue(issue) {
    const updateIssue = { state_event: 'reopen' };
    const options = GitLab.baseOptionsHttpReq();

    options.method = 'PUT';
    options.body = JSON.stringify(updateIssue);
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await nodeFetch(
        `${this.apiBaseURL}/projects/${this.projectId}/issues/${issue.iid}`,
        options,
      );
      const res = await response.json();

      if (response.ok) {
        logger.info(`Opened GitLab issue #${res.iid}`);
      } else {
        logger.error(`openIssue response: ${JSON.stringify(res)}`);
      }
    } catch (error) {
      logger.error(`Could not update GitLab issue #${issue.iid} "${issue.title}": ${error}`);
    }
  }

  async closeIssue(issue) {
    const updateIssue = { state_event: 'close' };

    const options = GitLab.baseOptionsHttpReq();

    options.method = 'PUT';
    options.body = JSON.stringify(updateIssue);
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await nodeFetch(
        `${this.apiBaseURL}/projects/${this.projectId}/issues/${issue.iid}`,
        options,
      );
      const res = await response.json();

      if (response.ok) {
        logger.info(`Closed GitLab issue #${issue.iid}`);
      } else {
        logger.error(`closeIssue response: ${JSON.stringify(res)}`);
      }
    } catch (error) {
      logger.error(`Could not update GitLab issue #${issue.iid} "${issue.title}": ${error}`);
    }
  }

  async getIssue({ title, ...searchParams }) {
    try {
      let apiUrl = `${this.apiBaseURL}/projects/${this.projectId}/issues?search=${encodeURIComponent(title)}&state=${searchParams.state}&per_page=100`;

      if (searchParams.state == 'all') apiUrl = `${this.apiBaseURL}/projects/${this.projectId}/issues?search=${encodeURIComponent(title)}&per_page=100`;

      const options = GitLab.baseOptionsHttpReq();

      options.method = 'GET';

      const response = await nodeFetch(apiUrl, options);
      const res = await response.json();

      if (response.ok) {
        const issues = res;

        const [issue] = issues.filter(item => item.title === title); // since only one is expected, use the first one

        return issue;
      }

      logger.error(`openIssue response: ${JSON.stringify(res)}`);
    } catch (error) {
      logger.error(`Could not find GitLab issue "${title}": ${error}`);
    }
  }

  async addCommentToIssue({ issue, comment }) {
    const body = { body: comment };

    const options = GitLab.baseOptionsHttpReq();

    options.method = 'POST';
    options.body = JSON.stringify(body);
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await nodeFetch(
        `${this.apiBaseURL}/projects/${this.projectId}/issues/${issue.iid}/notes`,
        options,
      );
      const res = await response.json();

      if (response.ok) {
        logger.info(`Added comment to GitLab issue #${issue.iid} ${issue.title}: ${res.id}`);

        return res.body;
      }

      logger.error(`openIssue response: ${JSON.stringify(res)}`);
    } catch (error) {
      logger.error(`Could not add comment to GitLab issue #${issue.iid} "${issue.title}": ${error}`);
    }
  }

  async closeIssueWithCommentIfExists({ title, comment }) {
    const issue = await this.getIssue({
      title,
      state: GitLab.ISSUE_STATE_OPEN,
    });

    // if issue does not exist in the "opened" state
    if (!issue) {
      return;
    }

    await this.addCommentToIssue({ issue, comment });

    return this.closeIssue(issue);
  }

  async createOrUpdateIssue({ title, description, labels }) {
    try {
      const issue = await this.getIssue({ title, state: GitLab.ISSUE_STATE_ALL });

      if (!issue) {
        const createdIssue = await this.createIssue({ title, description, labels });

        return logger.info(`Created GitLab issue #${createdIssue.iid} "${title}": ${createdIssue.web_url}`);
      }

      const managedLabelsNames = this.MANAGED_LABELS.map(label => label.name);
      const labelsNotManagedToKeep = issue.labels.map(label => label.name).filter(label => !managedLabelsNames.includes(label));
      const managedLabels = issue.labels.filter(label => managedLabelsNames.includes(label.name));

      if (issue.state !== GitLab.ISSUE_STATE_CLOSED && labels.every(label => managedLabels.some(managedLabel => managedLabel.name === label))) {
        return; // if all requested labels are already assigned to the issue, the error is redundant with the one already reported and no further action is necessary
      }

      if (issue.state == GitLab.ISSUE_STATE_CLOSED) {
        await this.openIssue(issue);
      }

      await this.setIssueLabels({
        issue,
        labels: [ ...labels, ...labelsNotManagedToKeep ],
      });

      await this.addCommentToIssue({ issue, comment: description });

      logger.info(`Updated GitLab issue with comment #${issue.iid}: ${issue.web_url}`);
    } catch (error) {
      logger.error(`Failed to update GitLab issue "${title}": ${error.stack}`);
    }
  }

  static baseOptionsHttpReq(token = process.env.OTA_ENGINE_GITLAB_TOKEN) {
    const options = {};

    if (process.env.HTTPS_PROXY) {
      options.agent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
    } else if (process.env.HTTP_PROXY) {
      options.agent = new HttpProxyAgent(process.env.HTTP_PROXY);
    }

    options.headers = { Authorization: `Bearer ${token}` };

    return options;
  }

  generateDeclarationURL(serviceName) {
    return `${this.baseURL}/${this.repositoryPath}/-/blob/main/declarations/${encodeURIComponent(serviceName)}.json`;
  }

  generateVersionURL(serviceName, termsType) {
    return `${this.baseURL}/${this.repositoryPath}/-/blob/main/${encodeURIComponent(serviceName)}/${encodeURIComponent(termsType)}.md`;
  }

  generateSnapshotsBaseUrl(serviceName, termsType) {
    return `${this.baseURL}/${this.repositoryPath}/-/blob/main/${encodeURIComponent(serviceName)}/${encodeURIComponent(termsType)}`;
  }

  // GitLab API responses are not cached unlike GitHub, so this method only exists to satisfy the Reporter interface contract
  clearCache() { /* eslint-disable-line class-methods-use-this */
    logger.debug('Cache clearing not implemented for GitLab reporter as it is not needed');
  }
}
