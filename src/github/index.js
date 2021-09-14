import { Octokit } from 'octokit';
import fs from 'fs';
import logger from '../logger/index.js';

const { version } = JSON.parse(
  fs.readFileSync(new URL('../../package.json', import.meta.url)).toString()
);

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN_CREATE_ISSUE,
  userAgent: `opentermsarchive/${version}`,
});
const GITHUB_OTA_OWNER = process.env.GITHUB_OTA_OWNER || '';
const GITHUB_OTA_REPO = process.env.GITHUB_OTA_REPO || '';

const ISSUE_STATE_CLOSED = 'closed';
const ISSUE_STATE_OPEN = 'open';

const commonParams = {
  owner: GITHUB_OTA_OWNER,
  repo: GITHUB_OTA_REPO,
  accept: 'application/vnd.github.v3+json',
};

export const isEnabled = !!process.env.GITHUB_TOKEN_CREATE_ISSUE && process.env.NODE_ENV !== 'test';

export const createIssue = async (params) => {
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

export const searchIssue = async ({ title, q, ...params }) => {
  if (!isEnabled) {
    return;
  }
  try {
    const qOnRepo = `${q} repo:${params.owner}/${params.repo}`;

    if (
      !cachedIssues[qOnRepo] ||
      (cachedIssues[qOnRepo].lastUpdated &&
        new Date().getTime() - cachedIssues[qOnRepo].lastUpdated > 1000 * 60 * 30) // cache is more than 30 minutes
    ) {
      const nbPerPage = 10;
      const request = {
        ...params,
        q: qOnRepo,
        per_page: nbPerPage,
        page: 1,
      };

      const { data, headers } = await octokit.rest.search.issuesAndPullRequests(request);
      logger.info(`Page 1: ${qOnRepo} (Left: ${headers['x-ratelimit-remaining']})`);
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
            headers: paginatedHeaders,
          } = await octokit.rest.search.issuesAndPullRequests({
            ...request,
            page,
          });
          logger.info(
            `Page ${page}: ${qOnRepo} (Left: ${paginatedHeaders['x-ratelimit-remaining']})`
          );
          foundItems = [...foundItems, ...paginatedData.items];
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
    return items.filter(
      (item) =>
        item.repository_url.endsWith(`${params.owner}/${params.repo}`) && item.title === title
    )[0];
  } catch (e) {
    logger.error('Could not search issue');
    logger.error(e.toString());
    throw e;
  }
};

export const addCommentToIssue = async (params) => {
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
    let existingIssue = await searchIssue({
      ...commonParams,
      title,
      q: `is:issue label:${labels.join(',')}`,
    });

    if (!existingIssue) {
      existingIssue = await createIssue({
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
    } else if (existingIssue.state === 'closed') {
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
    }
    return existingIssue;
  } catch (e) {
    logger.error('Could not create issue', e.toString());
  }
};

export const closeIssueIfExists = async ({ title, comment, labels }) => {
  if (!isEnabled) {
    return;
  }

  let existingIssue = await searchIssue({
    ...commonParams,
    title,
    q: `is:issue is:${ISSUE_STATE_OPEN} label:${labels.join(',')}`,
  });

  if (existingIssue) {
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

  return existingIssue;
};
