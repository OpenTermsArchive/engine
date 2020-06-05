import path from 'path';
import fsApi from 'fs';
const fs = fsApi.promises;

import * as git from './git.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export const ROOT_DIRECTORY = path.resolve(__dirname, '../../data');
export const RAW_DIRECTORY = `${ROOT_DIRECTORY}/raw`;
export const SANITIZED_DIRECTORY = `${ROOT_DIRECTORY}/sanitized`;

export async function persistRaw(serviceProviderId, policyType, fileContent) {
  await persist({
    serviceProviderId,
    policyType,
    fileContent,
    isSanitized: false
  });
}

export async function persistSanitized(serviceProviderId, policyType, fileContent) {
  await persist({
    serviceProviderId,
    policyType,
    fileContent,
    isSanitized: true
  });
}

export async function persist({ serviceProviderId, policyType, fileContent, isSanitized }) {
  await store({ serviceProviderId, policyType, fileContent, isSanitized });
  return await commit({ serviceProviderId, policyType, isSanitized });
}

export async function store({ serviceProviderId, policyType, fileContent, isSanitized }) {
const directory = `${isSanitized ? SANITIZED_DIRECTORY : RAW_DIRECTORY}/${serviceProviderId}`;

if (!fsApi.existsSync(directory)){
    fsApi.mkdirSync(directory);
  }

  return fs.writeFile(`${directory}/${policyType}.${isSanitized ? 'md' : 'html'}`, fileContent);
}

export async function commit({ serviceProviderId, policyType, isSanitized }) {
  const directory = `${isSanitized ? SANITIZED_DIRECTORY : RAW_DIRECTORY}/${serviceProviderId}`;
  const fileExtension = isSanitized ? 'md' : 'html'
  const filepath = path.relative(path.resolve(__dirname, '../..'), `${directory}/${policyType}.${fileExtension}`);

  const status = await git.status(filepath);
  if (!(status.includes('modified') || status.includes('added'))) {
    return;
  }

  await git.add(filepath);

  const message = `${isSanitized ? 'Sanitized update' : 'Update'} for ${serviceProviderId} ${policyType} document`;
  return git.commit(message);
}
