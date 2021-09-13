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

export const isEnabled = !!process.env.GITHUB_TOKEN_CREATE_ISSUE;

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

export const searchIssue = async (params) => {
  if (!isEnabled) {
    return;
  }
  try {
    const { data } = await octokit.rest.search.issuesAndPullRequests(params);

    // baseUrl should be the way to go instead of this ugly filter
    // that may not work in case there are too many issues
    // but it goes with a 404 using octokit
    // baseUrl: `https://api.github.com/${GITHUB_OTA_OWNER}/${GITHUB_OTA_REPO}`,
    return ((data && data.items) || []).filter((item) =>
      item.repository_url.endsWith(`${params.owner}/${params.repo}`)
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
      // baseUrl should be the way to go but it goes with a 404 using octokit
      // baseUrl: `https://api.github.com/${GITHUB_OTA_OWNER}/${GITHUB_OTA_REPO}`,
      q: `is:issue "${title}"`,
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

export const closeIssueIfExists = async ({ title, comment }) => {
  if (!isEnabled) {
    return;
  }

  let existingIssue = await searchIssue({
    ...commonParams,
    // baseUrl should be the way to go but it goes with a 404 using octokit
    // baseUrl: `https://api.github.com/${GITHUB_OTA_OWNER}/${GITHUB_OTA_REPO}`,
    q: `is:issue is:${ISSUE_STATE_OPEN} "${title}"`,
  });

  if (existingIssue) {
    logger.info(`🤖 `);
    await octokit.rest.issues.update({
      ...commonParams,
      issue_number: existingIssue.number,
      state: ISSUE_STATE_CLOSED,
    });
    logger.info(`🤖 `);
    await addCommentToIssue({
      ...commonParams,
      issue_number: existingIssue.number,
      body: comment,
    });
    logger.info(`🤖 Github issue closed for ${title}: ${existingIssue.html_url}`);
  }

  return existingIssue;
};
