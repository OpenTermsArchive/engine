import path from 'path';
import fsApi from 'fs';
const fs = fsApi.promises;

import * as git from './git.js';

export const ROOT_DIRECTORY = path.resolve() + '/data';
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
  try {
    const filepath = path.relative(path.resolve(), `${RAW_DIRECTORY}/${serviceProviderId}/${policyType}.html`);

    const status = await git.status({ filepath });
    if (!(status.includes('modified') || status.includes('added'))) {
      return;
    }

    await git.add({ filepath });

    return git.commit(`Changes for ${serviceProviderId} ${policyType} document`);
  } catch (e) {
    console.log(e);
  }
}
