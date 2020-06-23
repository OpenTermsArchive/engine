import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const dirPath = path.resolve(__dirname, '../..', process.env.NODE_ENV === 'test' ? 'test' : '', 'providers');
const sanitizers = {};

export default async function getServiceProviders() {
  const serviceProviders = {};

  const filenames = fs.readdirSync(dirPath);

  for (let filename of filenames) {
    if (filename.indexOf('.sanitizers.js') !== -1) {
      const serviceProviderId = path.basename(filename, '.sanitizers.js');
      sanitizers[serviceProviderId] = await import(path.join(dirPath, filename));
    } else if (filename.indexOf('.json') !== -1) {
      const serviceProviderId = path.basename(filename, '.json');
      serviceProviders[serviceProviderId] = JSON.parse(fs.readFileSync(path.join(dirPath, filename)));
    }
  }

  return serviceProviders;
}

export function getSanitizers(serviceProviderId) {
  return sanitizers[serviceProviderId];
}
