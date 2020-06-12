import path from 'path';
import fsApi from 'fs';
const fs = fsApi.promises;

import async from 'async';

const commitQueue = async.queue(_commit, 1);
commitQueue.error((err, { serviceProviderId, policyType, isSanitized, reject }) => {
  reject(new Error(`Could not commit ${policyType} for ${serviceProviderId} (${isSanitized ? 'sanitized' : 'raw'} version) due to error: ${err}`));
});

import * as git from './git.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const ROOT_DIRECTORY = path.resolve(__dirname, `../..${process.env.NODE_ENV === 'test' ? '/test/' : '/'}data`);
export const RAW_DIRECTORY = `${ROOT_DIRECTORY}/raw`;
export const SANITIZED_DIRECTORY = `${ROOT_DIRECTORY}/sanitized`;

export async function persist({ serviceProviderId, policyType, fileContent, isSanitized }) {
  await save({ serviceProviderId, policyType, fileContent, isSanitized });
  return await commit({ serviceProviderId, policyType, isSanitized });
}

export async function save({ serviceProviderId, policyType, fileContent, isSanitized }) {
  const directory = `${isSanitized ? SANITIZED_DIRECTORY : RAW_DIRECTORY}/${serviceProviderId}`;

  if (!fsApi.existsSync(directory)) {
    await fs.mkdir(directory);
  }

  const filePath = `${directory}/${policyType}.${isSanitized ? 'md' : 'html'}`;
  return fs.writeFile(filePath, fileContent).then(() => {
    console.log(`File ${filePath} saved.`)
  });
}

export async function commit({ serviceProviderId, policyType, isSanitized }) {
  const directory = `${isSanitized ? SANITIZED_DIRECTORY : RAW_DIRECTORY}/${serviceProviderId}`;
  const fileExtension = isSanitized ? 'md' : 'html'
  // Git needs a path relative to the .git directory, not an absolute one
  const filePath = path.relative(path.resolve(__dirname, '../..'), `${directory}/${policyType}.${fileExtension}`);

  const status = await git.status(filePath);
  if (!status.match(/^\*?(modified|added)/)) {
    return;
  }

  return new Promise((resolve, reject) => {
    commitQueue.push({ serviceProviderId, policyType, isSanitized, fileExtension, filePath, resolve, reject });
  });
}

async function _commit({ serviceProviderId, policyType, isSanitized, fileExtension, filePath, resolve }) {
  await git.add(filePath);
  const sha = await git.commit(`Update ${isSanitized ? 'sanitized' : 'raw'} ${policyType} for ${serviceProviderId}`);
  console.log(`Commit ID for document "${serviceProviderId}/${policyType}.${fileExtension}": ${sha}`);
  resolve(sha);
}
