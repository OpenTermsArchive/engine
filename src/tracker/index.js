import fs from 'fs';

import config from 'config';
import { Octokit } from 'octokit';

import logger from '../logger/index.js';

const { version } = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url)).toString());

const ISSUE_STATE_CLOSED = 'closed';
const ISSUE_STATE_OPEN = 'open';
const ISSUE_STATE_ALL = 'all';

const UPDATE_DOCUMENT_LABEL = config.get('tracker.githubIssues.label');

const LOCAL_CONTRIBUTE_URL = 'http://localhost:3000/en/service';
const CONTRIBUTE_URL = 'https://contribute.opentermsarchive.org/en/service';
const GITHUB_REPO_URL = `https://github.com/${config.get('tracker.githubIssues.repository')}/blob/main/declarations`;
const GOOGLE_URL = 'https://www.google.com/search?q=';

export default class Tracker {
  static isTokenValid() {
    return (config.get('tracker.githubIssues.repository') || '').includes('/');
  }

  constructor() {
    if (!Tracker.isTokenValid()) {
      throw new Error('tracker.githubIssues.repository should be a string with <owner>/<repo>');
    }

    const [ owner, repo ] = config.get('tracker.githubIssues.repository').split('/');

    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
      userAgent: `opentermsarchive/${version}`,
    });
    this.cachedIssues = {};
    this.commonParams = {
      owner,
      repo,
      accept: 'application/vnd.github.v3+json',
    };

    this.initialize();
  }

  async initialize() {
    await this.createLabel({
      name: config.get('tracker.githubIssues.label'),
      color: config.get('tracker.githubIssues.color'),
      description: config.get('tracker.githubIssues.description'),
    });
  }

  async onVersionRecorded(serviceId, type) {
    await this.closeIssueIfExists({
      labels: [UPDATE_DOCUMENT_LABEL],
      title: `Fix ${serviceId} - ${type}`,
      comment: '🤖 Closed automatically as data was gathered successfully',
    });
  }

  async onVersionNotChanged(serviceId, type) {
    await this.closeIssueIfExists({
      labels: [UPDATE_DOCUMENT_LABEL],
      title: `Fix ${serviceId} - ${type}`,
      comment: '🤖 Closed automatically as version is unchanged but data has been fetched correctly',
    });
  }

  async onFirstVersionRecorded(serviceId, type) {
    return this.onVersionRecorded(serviceId, type);
  }

  async onInaccessibleContent(error, serviceId, type, documentDeclaration) {
    const { location, contentSelectors, noiseSelectors } = documentDeclaration;

    const { title, body } = Tracker.formatIssueTitleAndBody({
      contentSelectors,
      noiseSelectors,
      url: location,
      name: serviceId,
      documentType: type,
      message: error.toString(),
    });

    await this.createIssueIfNotExists({
      title,
      body,
      labels: [UPDATE_DOCUMENT_LABEL],
      comment: '🤖 Reopened automatically as an error occured',
    });
  }

  async createLabel(params) {
    return this.octokit.rest.issues.createLabel({ ...this.commonParams, ...params })
      .catch(error => {
        if (error.toString().includes('"code":"already_exists"')) {
          return;
        }
        logger.error(`Could not create label "${params.name}": ${error.toString()}`);
      });
  }

  async createIssue(params) {
    try {
      const { data } = await this.octokit.rest.issues.create(params);

      return data;
    } catch (e) {
      logger.error('Could not create issue');
      logger.error(e.toString());

      return null;
    }
  }

  async searchIssues({ title, ...searchParams }) {
    try {
      const request = {
        per_page: 100,
        ...searchParams,
      };

      const issues = await this.octokit.paginate(
        this.octokit.rest.issues.listForRepo,
        request,
        response => response.data,
      );

      const issuesWithSameTitle = issues.filter(item => item.title === title);

      return issuesWithSameTitle;
    } catch (e) {
      logger.error('Could not search issue');
      logger.error(e.toString());
      throw e;
    }
  }

  async addCommentToIssue(params) {
    try {
      const { data } = await this.octokit.rest.issues.createComment(params);

      return data;
    } catch (e) {
      logger.error('Could not add comment to issue:', e.toString());

      return null;
    }
  }

  async createIssueIfNotExists({ title, body, labels, comment }) {
    try {
      const existingIssues = await this.searchIssues({ ...this.commonParams, title, labels, state: ISSUE_STATE_ALL });

      if (!existingIssues.length) {
        const existingIssue = await this.createIssue({ ...this.commonParams, title, body, labels });

        if (existingIssue) {
          logger.info(`🤖 Creating Github issue for ${title}: ${existingIssue.html_url}`);
        } else {
          logger.error(`🤖 Could not create Github issue for ${title}`);
        }

        return existingIssue;
      }

      const openedIssues = existingIssues.filter(existingIssue => existingIssue.state === ISSUE_STATE_OPEN);
      const hasNoneOpened = openedIssues.length === 0;

      for (const existingIssue of existingIssues) {
        if (hasNoneOpened) {
          /* eslint-disable no-await-in-loop */
          await this.octokit.rest.issues.update({
            ...this.commonParams,
            issue_number: existingIssue.number,
            state: ISSUE_STATE_OPEN,
          });
          await this.addCommentToIssue({
            ...this.commonParams,
            issue_number: existingIssue.number,
            body: `${comment}\n${body}`,
          });
          /* eslint-enable no-await-in-loop */
          logger.info(`🤖 Reopened automatically as an error occured for ${title}: ${existingIssue.html_url}`);
          break;
        }
      }

      return existingIssues;
    } catch (e) {
      logger.error('Could not create issue', e.toString());
    }
  }

  async closeIssueIfExists({ title, comment, labels }) {
    const openedIssues = await this.searchIssues({ ...this.commonParams, title, labels, state: ISSUE_STATE_OPEN });

    if (!openedIssues) {
      return;
    }

    for (const openedIssue of openedIssues) {
      await this.octokit.rest.issues.update({ ...this.commonParams, issue_number: openedIssue.number, state: ISSUE_STATE_CLOSED }); // eslint-disable-line no-await-in-loop
      await this.addCommentToIssue({ ...this.commonParams, issue_number: openedIssue.number, body: comment }); // eslint-disable-line no-await-in-loop
      logger.info(`🤖 Github issue closed for ${title}: ${openedIssue.html_url}`);
    }
  }

  static formatIssueTitleAndBody(messageOrObject) {
    const { message, contentSelectors, noiseSelectors, url, name, documentType } = messageOrObject;
    let contentSelectorsAsArray = contentSelectors;
    let noiseSelectorsAsArray = noiseSelectors;

    if (typeof contentSelectors === 'string') {
      contentSelectorsAsArray = contentSelectors.split(',');
    } else if (!Array.isArray(contentSelectors)) {
      contentSelectorsAsArray = [];
    }

    if (typeof noiseSelectors === 'string') {
      noiseSelectorsAsArray = noiseSelectors.split(',');
    } else if (!Array.isArray(noiseSelectors)) {
      noiseSelectorsAsArray = [];
    }

    const contentSelectorsAsArrayEncoded = contentSelectorsAsArray.map(encodeURIComponent);
    const noiseSelectorsAsArrayEncoded = noiseSelectorsAsArray.map(encodeURIComponent);

    const contentSelectorsQueryString = contentSelectorsAsArrayEncoded.length ? `&selectedCss[]=${contentSelectorsAsArrayEncoded.join('&selectedCss[]=')}` : '';
    const noiseSelectorsQueryString = noiseSelectorsAsArrayEncoded.length ? `&removedCss[]=${noiseSelectorsAsArrayEncoded.join('&removedCss[]=')}` : '';

    const encodedName = encodeURIComponent(name);
    const encodedType = encodeURIComponent(documentType);
    const encodedUrl = encodeURIComponent(url);
    const encodedDestination = encodeURIComponent(config.get('tracker.githubIssues.repository'));

    const urlQueryParams = `destination=${encodedDestination}&step=2&url=${encodedUrl}&name=${encodedName}&documentType=${encodedType}${noiseSelectorsQueryString}${contentSelectorsQueryString}&expertMode=true`;

    const message404 = message.includes('404') ? `- Search Google to get the new url: ${GOOGLE_URL}%22${encodedName}%22+%22${encodedType}%22` : '';

    const title = `Fix ${name} - ${documentType}`;

    const body = `
  This service is not available anymore.
  Please fix it.

  \`${message}\`

  Here some ideas on how to fix this issue:
  - See what's wrong online: ${CONTRIBUTE_URL}?${urlQueryParams}
  - Or on your local: ${LOCAL_CONTRIBUTE_URL}?${urlQueryParams}
  ${message404}

  And some info about what has already been tracked
  - See original JSON file: ${GITHUB_REPO_URL}/${encodedName}.json

  Thanks
  `;

    return {
      title,
      body,
    };
  }
}
