import path from 'path';
import fsApi from 'fs';
const fs = fsApi.promises;

import * as git from './git.js';

export const ROOT_DIRECTORY = path.resolve() + '/data';
export const RAW_DIRECTORY = `${ROOT_DIRECTORY}/raw`;


export async function storeRaw(serviceProviderId, policyType, fileContent) {
  return fs.writeFile(`${RAW_DIRECTORY}/${serviceProviderId}/${policyType}.html`, fileContent);
}

export async function commitRaw(serviceProviderId, policyType) {
  try {
    const filepath = path.relative(path.resolve(), `${RAW_DIRECTORY}/${serviceProviderId}/${policyType}.html`);

    const status = await git.status({ filepath });
    if (!(status.includes('modified') || status.includes('added'))) {
      return;
    }

    await git.add({ filepath });

    const sha = await git.commit({ message: `Changes for ${serviceProviderId} ${policyType} document` });

    return sha;
  } catch (e) {
    console.log(e);
  }
}
