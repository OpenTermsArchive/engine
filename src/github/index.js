import { Octokit } from 'octokit';
import fs from 'fs';

import logger from '../logger/index.js';

const { version } = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url)).toString());

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN_CREATE_ISSUE,
  userAgent: `opentermsarchive/${version}`,
});
const GITHUB_OTA_OWNER = process.env.GITHUB_OTA_OWNER || '';
const GITHUB_OTA_REPO = process.env.GITHUB_OTA_REPO || '';

const ISSUE_STATE_CLOSED = 'closed';
const ISSUE_STATE_OPEN = 'open';

const LOCAL_CONTRIBUTE_URL = 'http://localhost:3000/contribute/service';
const CONTRIBUTE_URL = 'https://opentermsarchive.org/contribute/service';
const GITHUB_VERSIONS_URL = 'https://github.com/ambanum/OpenTermsArchive-versions/blob/master';
const GITHUB_REPO_URL = 'https://github.com/ambanum/OpenTermsArchive/blob/master/services';
const GOOGLE_URL = 'https://www.google.com/search?q=';

const commonParams = {
  owner: GITHUB_OTA_OWNER,
  repo: GITHUB_OTA_REPO,
  accept: 'application/vnd.github.v3+json',
};

export const isEnabled = !!process.env.GITHUB_TOKEN_CREATE_ISSUE && process.env.NODE_ENV !== 'test';

/* eslint-disable no-await-in-loop */
export const createIssue = async params => {
  if (!isEnabled) {
    return;
  }
  try {
    const { data } = await octokit.rest.issues.create(params);

    return data;
  } catch (e) {
    logger.error('Could not create issue');
    logger.error(e.toString());
    return null;
  }
};

const cachedIssues = {};

export const searchIssues = async ({ title, q, ...params }) => {
  if (!isEnabled) {
    return;
  }
  try {
    const qOnRepo = `${q} repo:${params.owner}/${params.repo}`;

    if (
      !cachedIssues[qOnRepo]
      || (cachedIssues[qOnRepo].lastUpdated
        && new Date().getTime() - cachedIssues[qOnRepo].lastUpdated > 1000 * 60 * 30) // cache is more than 30 minutes
    ) {
      const nbPerPage = 100;
      const request = {
        ...params,
        q: qOnRepo,
        per_page: nbPerPage,
        page: 1,
      };

      const { data } = await octokit.rest.search.issuesAndPullRequests(request);

      let foundItems = data.items;
      // we need to do this because error being asynchronous, if we do not and wait for
      // subsequent pages to be fetch, we could end up in a situation when
      // a new error comes in and fetches also the first page as cache is not setup yet
      cachedIssues[qOnRepo] = {
        lastUpdatedAt: new Date().getTime(),
        items: foundItems,
      };

      const nbPages = Math.ceil(data.total_count / nbPerPage);
      if (nbPages > 1) {
        for (let page = 2; page <= nbPages; page++) {
          const {
            data: paginatedData,
          } = await octokit.rest.search.issuesAndPullRequests({
            ...request,
            page,
          });

          foundItems = [ ...foundItems, ...paginatedData.items ];
        }
      }

      cachedIssues[qOnRepo] = {
        lastUpdatedAt: new Date().getTime(),
        items: foundItems,
      };
    }
    const items = cachedIssues[qOnRepo].items || [];
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
};

export const addCommentToIssue = async params => {
  if (!isEnabled) {
    return;
  }
  try {
    const { data } = await octokit.rest.issues.createComment(params);
    return data;
  } catch (e) {
    logger.error('Could not add comment to issue');
    logger.error(e.toString());
    return null;
  }
};

export const createIssueIfNotExist = async ({ title, body, labels, comment }) => {
  if (!isEnabled) {
    return;
  }

  try {
    const existingIssues = await searchIssues({
      ...commonParams,
      title,
      q: `is:issue label:${labels.join(',')}`,
    });

    if (!existingIssues[0]) {
      const existingIssue = await createIssue({
        ...commonParams,
        title,
        body,
        labels,
      });
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
        await octokit.rest.issues.update({
          ...commonParams,
          issue_number: existingIssue.number,
          state: ISSUE_STATE_OPEN,
        });
        await addCommentToIssue({
          ...commonParams,
          issue_number: existingIssue.number,
          body: comment,
        });
        break;
      }
    }
    return existingIssues;
  } catch (e) {
    logger.error('Could not create issue', e.toString());
  }
};

export function formatIssueTitleAndBody(messageOrObject) {
  const { message, contentSelectors, noiseSelectors, url, name, documentType } = messageOrObject;

  /* eslint-disable no-nested-ternary */
  const contentSelectorsAsArray = (typeof contentSelectors === 'string'
    ? contentSelectors.split(',')
    : Array.isArray(contentSelectors)
      ? contentSelectors
      : []
  ).map(encodeURIComponent);

  const noiseSelectorsAsArray = (typeof noiseSelectors === 'string'
    ? noiseSelectors.split(',')
    : Array.isArray(noiseSelectors)
      ? noiseSelectors
      : []
  ).map(encodeURIComponent);
  /* eslint-enable no-nested-ternary */

  const contentSelectorsQueryString = contentSelectorsAsArray.length
    ? `&selectedCss[]=${contentSelectorsAsArray.join('&selectedCss[]=')}`
    : '';
  const noiseSelectorsQueryString = noiseSelectorsAsArray.length
    ? `&removedCss[]=${noiseSelectorsAsArray.join('&removedCss[]=')}`
    : '';

  const encodedName = encodeURIComponent(name);
  const encodedType = encodeURIComponent(documentType);
  const encodedUrl = encodeURIComponent(url);

  const urlQueryParams = `step=2&url=${encodedUrl}&name=${encodedName}&documentType=${encodedType}${noiseSelectorsQueryString}${contentSelectorsQueryString}&expertMode=true`;

  const message404 = message.includes('404')
    ? `- Search Google to get the new url: ${GOOGLE_URL}%22${encodedName}%22+%22${encodedType}%22`
    : '';

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

export const closeIssueIfExists = async ({ title, comment, labels }) => {
  if (!isEnabled) {
    return;
  }

  const existingIssues = await searchIssues({
    ...commonParams,
    title,
    q: `is:issue is:${ISSUE_STATE_OPEN} label:${labels.join(',')}`,
  });

  if (existingIssues) {
    for (const existingIssue of existingIssues) {
      await octokit.rest.issues.update({
        ...commonParams,
        issue_number: existingIssue.number,
        state: ISSUE_STATE_CLOSED,
      });
      await addCommentToIssue({
        ...commonParams,
        issue_number: existingIssue.number,
        body: comment,
      });
      logger.info(`🤖 Github issue closed for ${title}: ${existingIssue.html_url}`);
    }
  }

  return existingIssues;
};
