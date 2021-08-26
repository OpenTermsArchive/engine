import { Octokit } from 'octokit';
import logger from '../logger/index.js';
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN_CREATE_ISSUE,
  userAgent: `opentermsarchive`,
});
const GITHUB_OTA_OWNER = process.env.GITHUB_OTA_OWNER || '';
const GITHUB_OTA_REPO = process.env.GITHUB_OTA_REPO || '';

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
    console.error(e);
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
    console.error(e);
    return null;
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
    console.error(e);
    return null;
  }
};

export const createIssueIfNotExist = async ({ title, body, labels }) => {
  if (!isEnabled) {
    return;
  }
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

    logger.info(
      `🤖 Creating Github issue for ${title} ${existingIssue.html_url}`,
      existingIssue.html_url
    );
  }

  return existingIssue;
};
