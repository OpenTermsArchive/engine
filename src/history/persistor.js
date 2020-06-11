import path from 'path';
import fsApi from 'fs';
const fs = fsApi.promises;

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

  if (!fsApi.existsSync(directory)){
    fsApi.mkdirSync(directory);
  }

  const filePath = `${directory}/${policyType}.${isSanitized ? 'md' : 'html'}`;
  return fs.writeFile(filePath, fileContent).then(() => {
    console.log(`File ${filePath} saved.`)
  });
}

let lock = Promise.resolve('Initial Promise');
export async function commit({ serviceProviderId, policyType, isSanitized }) {
  const directory = `${isSanitized ? SANITIZED_DIRECTORY : RAW_DIRECTORY}/${serviceProviderId}`;
  const fileExtension = isSanitized ? 'md' : 'html'
  const filePath = path.relative(path.resolve(__dirname, '../..'), `${directory}/${policyType}.${fileExtension}`);

  const status = await git.status(filePath);
  if (!status.match(/^\*?(modified|added)/)) {
    return;
  }

  // Ensure asynchronous functions `git.add` and `git.commit` will always be called in sequence…
  // …and others caller of `persistor.commit` will wait
  await lock;
  lock = new Promise(resolveLock => {
    git.add(filePath).then(() => {
      git.commit(`${isSanitized ? 'Update sanitized' : 'Update'} ${serviceProviderId} ${policyType} document`).then((sha) => {
        console.log(`Commit ID for document "${serviceProviderId}/${policyType}.${fileExtension}": ${sha}`);
        resolveLock(sha);
      });
    });
  });

  return lock;
}
