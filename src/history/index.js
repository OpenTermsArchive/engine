import path from 'path';
import fsApi from 'fs';
const fs = fsApi.promises;

const ROOT_DIRECTORY = path.resolve('../../data');
const RAW_DIRECTORY = `${ROOT_DIRECTORY}/raw`;


export async function storeRaw(serviceProviderId, policyType, fileContent) {
  return fs.writeFile(`${RAW_DIRECTORY}/${serviceProviderId}/${policyType}.html`, fileContent);
}
