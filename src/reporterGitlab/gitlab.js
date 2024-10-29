import { createRequire } from 'module';

import HttpProxyAgent from 'http-proxy-agent';
import HttpsProxyAgent from 'https-proxy-agent';
import nodeFetch from 'node-fetch';

import logger from '../logger/index.js';

const require = createRequire(import.meta.url);

export const MANAGED_BY_OTA_MARKER = '[managed by OTA]';

export default class GitLab {
  static ISSUE_STATE_CLOSED = 'closed';
  static ISSUE_STATE_OPEN = 'opened';
  static ISSUE_STATE_ALL = 'all';

  constructor(repository) {
    const [ owner, repo ] = repository.split('/');

    this.commonParams = { owner, repo };
    this.projectId = null;
    const gitlabUrl = process.env.OTA_ENGINE_GITLAB_API_BASE_URL;

    this.gitlabUrl = gitlabUrl;
  }

  async initialize() {
    const options = GitLab.baseOptionsHttpReq();

    try {
      const repositoryPath = `${this.commonParams.owner}/${this.commonParams.repo}`;
      const response = await nodeFetch(
        `${this.gitlabUrl}/projects/${encodeURIComponent(repositoryPath)}`,
        options,
      );

      const res = await response.json();

      if (response.ok) {
        this.projectId = res.id;
      } else {
        logger.error(`🤖 Error while obtaining projectId: ${JSON.strinfigy(res)}`);
        this.projectId = null;
      }
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
      const options = GitLab.baseOptionsHttpReq();
      const response = await nodeFetch(
        `${this.gitlabUrl}/projects/${this.projectId}/labels?with_counts=true`,
        options,
      );
      const res = await response.json();

      if (response.ok) {
        return res;
      }

      logger.error(`🤖 Failed to get labels: ${response.status} - ${JSON.stringify(res)}`);

      return null;
    } catch (error) {
      logger.error(`🤖 Could get labels: ${error}`);
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
        `${this.gitlabUrl}/projects/${this.projectId}/labels`,
        options,
      );

      const res = await response.json();

      if (response.ok) {
        logger.info(`🤖 New label created: ${res.name} , color: ${res.color}`);
      } else {
        logger.error(`createLabel response: ${JSON.stringify(res)}`);
      }
    } catch (error) {
      logger.error(`🤖 Failed to create label: ${error}`);
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
        `${this.gitlabUrl}/projects/${this.projectId}/issues`,
        options,
      );

      const res = await response.json();

      if (response.ok) {
        logger.info(`🤖 Created GitLab issue #${res.iid} "${title}": ${res.web_url}`);

        return res;
      }

      logger.error(`createIssue response: ${JSON.stringify(res)}`);
    } catch (error) {
      logger.error(`🤖 Could not create GitLab issue "${title}": ${error}`);
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
        `${this.gitlabUrl}/projects/${this.projectId}/issues/${issue.iid}`,
        options,
      );

      const res = await response.json();

      if (response.ok) {
        logger.info(`🤖 Updated labels to GitLab issue #${issue.iid}`);
      } else {
        logger.error(`setIssueLabels response: ${JSON.stringify(res)}`);
      }
    } catch (error) {
      logger.error(`🤖 Could not update GitLab issue #${issue.iid} "${issue.title}": ${error}`);
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
        `${this.gitlabUrl}/projects/${this.projectId}/issues/${issue.iid}`,
        options,
      );
      const res = await response.json();

      if (response.ok) {
        logger.info(`🤖 Opened GitLab issue #${res.iid}`);
      } else {
        logger.error(`openIssue response: ${JSON.stringify(res)}`);
      }
    } catch (error) {
      logger.error(`🤖 Could not update GitLab issue #${issue.iid} "${issue.title}": ${error}`);
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
        `${this.gitlabUrl}/projects/${this.projectId}/issues/${issue.iid}`,
        options,
      );
      const res = await response.json();

      if (response.ok) {
        logger.info(`🤖 Closed GitLab issue #${issue.iid}`);
      } else {
        logger.error(`closeIssue response: ${JSON.stringify(res)}`);
      }
    } catch (error) {
      logger.error(`🤖 Could not update GitLab issue #${issue.iid} "${issue.title}": ${error}`);
    }
  }

  async getIssue({ title, ...searchParams }) {
    try {
      let apiUrl = `${this.gitlabUrl}/projects/${this.projectId}/issues?state=${searchParams.state}&per_page=100`;

      if (searchParams.state == 'all') apiUrl = `${this.gitlabUrl}/projects/${this.projectId}/issues?per_page=100`;
      apiUrl = `${this.gitlabUrl}/projects/${this.projectId}/issues?search=${encodeURIComponent(title)}&per_page=100`;

      const options = GitLab.baseOptionsHttpReq();

      options.method = 'GET';

      const response = await nodeFetch(apiUrl, options);
      const res = await response.json();

      if (response.ok) {
        logger.debug(`response data: ${JSON.stringify(res)}`);
        const issues = res;

        const [issue] = issues.filter(item => item.title === title); // since only one is expected, use the first one

        return issue;
      }

      logger.error(`openIssue response: ${JSON.stringify(res)}`);
    } catch (error) {
      logger.error(`🤖 Could not find GitLab issue "${title}": ${error}`);
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
        `${this.gitlabUrl}/projects/${this.projectId}/issues/${issue.iid}/notes`,
        options,
      );
      const res = await response.json();

      if (response.ok) {
        logger.info(`🤖 Added comment to GitLab issue #${issue.iid} ${issue.title}: ${res.id}`);

        return res.body;
      }

      logger.error(`openIssue response: ${JSON.stringify(res)}`);
    } catch (error) {
      logger.error(`🤖 Could not add comment to GitLab issue #${issue.iid} "${issue.title}": ${error}`);
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
}
