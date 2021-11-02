import fs from 'fs';

import { Octokit } from 'octokit';

import logger from '../logger/index.js';

const { version } = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url)).toString());

const GITHUB_OTA_OWNER = process.env.GITHUB_OTA_OWNER || '';
const GITHUB_OTA_REPO = process.env.GITHUB_OTA_REPO || '';

const ISSUE_STATE_CLOSED = 'closed';
const ISSUE_STATE_OPEN = 'open';

const FIX_DOCUMENT_LABEL = 'fix-document';

const LOCAL_CONTRIBUTE_URL = 'http://localhost:3000/contribute/service';
const CONTRIBUTE_URL = 'https://opentermsarchive.org/contribute/service';
const GITHUB_VERSIONS_URL = 'https://github.com/ambanum/OpenTermsArchive-versions/blob/master';
const GITHUB_REPO_URL = 'https://github.com/ambanum/OpenTermsArchive/blob/master/services';
const GOOGLE_URL = 'https://www.google.com/search?q=';

export default class GitHub {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN_CREATE_ISSUE,
      userAgent: `opentermsarchive/${version}`,
    });
    this.cachedIssues = {};
    this.commonParams = {
      owner: GITHUB_OTA_OWNER,
      repo: GITHUB_OTA_REPO,
      accept: 'application/vnd.github.v3+json',
    };
  }

  async onVersionRecorded(serviceId, type) {
    await this.closeIssueIfExists({
      labels: [FIX_DOCUMENT_LABEL],
      title: `Fix ${serviceId} - ${type}`,
      comment: '🤖 Closed automatically as data was gathered successfully',
    });
  }

  async onFirstVersionRecorded(serviceId, type) {
    return this.onVersionRecorded(serviceId, type);
  }

  async onInaccessibleContent(error, serviceId, type, documentDeclaration) {
    const { location, contentSelectors, noiseSelectors } = documentDeclaration;

    const { title, body } = GitHub.formatIssueTitleAndBody({
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
      labels: [FIX_DOCUMENT_LABEL],
      comment: '🤖 Reopened automatically as an error occured',
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

  async searchIssues({ title, q, ...params }) {
    try {
      const qOnRepo = `${q} repo:${params.owner}/${params.repo}`;

      if (!this.cachedIssues[qOnRepo]
        || (this.cachedIssues[qOnRepo].lastUpdated && new Date().getTime() - this.cachedIssues[qOnRepo].lastUpdated > 1000 * 60 * 30) // cache is more than 30 minutes
      ) {
        const nbPerPage = 100;
        const request = {
          ...params,
          q: qOnRepo,
          per_page: nbPerPage,
          page: 1,
        };

        const { data } = await this.octokit.rest.search.issuesAndPullRequests(request);

        let foundItems = data.items;

        // we need to do this because error being asynchronous, if we do not and wait for
        // subsequent pages to be fetch, we could end up in a situation when
        // a new error comes in and fetches also the first page as cache is not setup yet
        this.cachedIssues[qOnRepo] = { lastUpdatedAt: new Date().getTime(), items: foundItems };

        const nbPages = Math.ceil(data.total_count / nbPerPage);

        if (nbPages > 1) {
          for (let page = 2; page <= nbPages; page++) {
            const { data: paginatedData } = await this.octokit.rest.search.issuesAndPullRequests({ ...request, page }); // eslint-disable-line no-await-in-loop

            foundItems = [ ...foundItems, ...paginatedData.items ];
          }
        }

        this.cachedIssues[qOnRepo] = { lastUpdatedAt: new Date().getTime(), items: foundItems };
      }
      const items = this.cachedIssues[qOnRepo].items || [];

      // baseUrl should be the way to go instead of this ugly filter
      // that may not work in case there are too many issues
      // but it goes with a 404 using octokit
      // baseUrl: `https://api.github.com/${GITHUB_OTA_OWNER}/${GITHUB_OTA_REPO}`,
      return items.filter(item => item.repository_url.endsWith(`${params.owner}/${params.repo}`) && item.title === title);
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
      const existingIssues = await this.searchIssues({ ...this.commonParams, title, q: `is:issue label:${labels.join(',')}` });

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
          await this.octokit.rest.issues.update({ ...this.commonParams, issue_number: existingIssue.number, state: ISSUE_STATE_OPEN }); // eslint-disable-line no-await-in-loop
          await this.addCommentToIssue({ ...this.commonParams, issue_number: existingIssue.number, body: comment }); // eslint-disable-line no-await-in-loop
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
    const existingIssues = await this.searchIssues({ ...this.commonParams, title, q: `is:issue is:${ISSUE_STATE_OPEN} label:${labels.join(',')}` });

    if (existingIssues) {
      for (const existingIssue of existingIssues) {
        await this.octokit.rest.issues.update({ ...this.commonParams, issue_number: existingIssue.number, state: ISSUE_STATE_CLOSED }); // eslint-disable-line no-await-in-loop
        await this.addCommentToIssue({ ...this.commonParams, issue_number: existingIssue.number, body: comment }); // eslint-disable-line no-await-in-loop
        logger.info(`🤖 Github issue closed for ${title}: ${existingIssue.html_url}`);
      }
    }

    return existingIssues;
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

    const urlQueryParams = `step=2&url=${encodedUrl}&name=${encodedName}&documentType=${encodedType}${noiseSelectorsQueryString}${contentSelectorsQueryString}&expertMode=true`;

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
  - See all versions tracked here: ${GITHUB_VERSIONS_URL}/${encodedName}/${encodedType}.md
  - See original JSON file: ${GITHUB_REPO_URL}/${encodedName}.json

  Thanks
  `;

    return {
      title,
      body,
    };
  }
}
