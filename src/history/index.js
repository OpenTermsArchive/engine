import path from 'path';
import fsApi from 'fs';
const fs = fsApi.promises;

import * as git from './git.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export const ROOT_DIRECTORY = path.resolve(__dirname, '../../data');
export const RAW_DIRECTORY = `${ROOT_DIRECTORY}/raw`;

export async function persistRaw(serviceProviderId, policyType, fileContent) {
  await storeRaw(serviceProviderId, policyType, fileContent);
  return commitRaw(serviceProviderId, policyType);
}

export async function storeRaw(serviceProviderId, policyType, fileContent) {
  const dir = `${RAW_DIRECTORY}/${serviceProviderId}`;

  if (!fsApi.existsSync(dir)){
    fsApi.mkdirSync(dir);
  }

  return fs.writeFile(`${dir}/${policyType}.html`, fileContent);
}

export async function commitRaw(serviceProviderId, policyType) {
  const filepath = path.relative(path.resolve(__dirname, '../..'), `${RAW_DIRECTORY}/${serviceProviderId}/${policyType}.html`);

  const status = await git.status(filepath);
  if (!(status.includes('modified') || status.includes('added'))) {
    return;
  }

  await git.add(filepath);

  return git.commit(`Update for ${serviceProviderId} ${policyType} document`);
}
