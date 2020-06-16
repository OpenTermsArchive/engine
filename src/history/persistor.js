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

const ROOT_DIRECTORY = path.resolve(__dirname, `../../data`);
export const RAW_DIRECTORY = `${ROOT_DIRECTORY}/raw`;
export const SANITIZED_DIRECTORY = `${ROOT_DIRECTORY}/sanitized`;

export async function persist({ serviceProviderId, policyType, fileContent, isSanitized }) {
  const filePath = await save({ serviceProviderId, policyType, fileContent, isSanitized });
  const message = `Update ${isSanitized ? 'sanitized' : 'raw'} ${serviceProviderId} ${DOCUMENTS_TYPES[policyType].name} document`;
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
  return fs.writeFile(filePath, fileContent).then(() => filePath);
}

export async function commit(filePath, message) {
  if (!await git.fileNeedsCommit(filePath)) {
    return;
  }

  return new Promise((resolve, reject) => {
    commitQueue.push({ filePath, message, resolve, reject });
  });
}

async function _commit({ filePath, message, resolve }) {
  await git.add(filePath);
  resolve(await git.commit(filePath, message));
}
