import path from 'path';
import fsApi from 'fs';
const fs = fsApi.promises;

import async from 'async';

const commitQueue = async.queue(_commit, 1);
commitQueue.error((err, { serviceProviderId, policyType, isSanitized, reject }) => {
  reject(new Error(`Could not commit ${policyType} for ${serviceProviderId} (${isSanitized ? 'sanitized' : 'raw'} version) due to error: ${err}`));
});

import * as git from './git.js';
import { DOCUMENTS_TYPES } from '../documents_types.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const ROOT_DIRECTORY = path.resolve(__dirname, `../..${process.env.NODE_ENV === 'test' ? '/test/' : '/'}data`);
export const RAW_DIRECTORY = `${ROOT_DIRECTORY}/raw`;
export const SANITIZED_DIRECTORY = `${ROOT_DIRECTORY}/sanitized`;

export async function persist({ serviceProviderId, policyType, fileContent, isSanitized }) {
  const filePath = await save({ serviceProviderId, policyType, fileContent, isSanitized });
  const message = `${isSanitized ? 'Update sanitized' : 'Update'} ${serviceProviderId} ${DOCUMENTS_TYPES[policyType].name} document`;
  const sha = await commit(filePath, message);
  return {
    filePath,
    sha
  };
}

export async function save({ serviceProviderId, policyType, fileContent, isSanitized }) {
  const directory = `${isSanitized ? SANITIZED_DIRECTORY : RAW_DIRECTORY}/${serviceProviderId}`;

  if (!fsApi.existsSync(directory)) {
    await fs.mkdir(directory);
  }

  const filePath = `${directory}/${DOCUMENTS_TYPES[policyType].fileName}.${isSanitized ? 'md' : 'html'}`;
  return fs.writeFile(filePath, fileContent).then(() => {
    return filePath;
  });
}

export async function commit(filePath, message) {
  // Git needs a path relative to the .git directory, not an absolute one
  const relativeFilePath = path.relative(path.resolve(__dirname, '../..'), filePath);

  const status = await git.status();
  if ((status.modified.indexOf(relativeFilePath) === -1) &&
      (status.not_added.indexOf(relativeFilePath) === -1)) {
    return;
  }

  return new Promise((resolve, reject) => {
    commitQueue.push({ filePath: relativeFilePath, message, resolve, reject });
  });
}

async function _commit({ filePath, message, resolve }) {
  await git.add(filePath);
  const commitSummary = await git.commit(filePath, message);
  resolve(commitSummary.commit);
}
