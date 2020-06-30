import fs from 'fs';
import path from 'path';

export default async function loadServiceProviders(dirPath) {
  const serviceProviders = {};

  const filenames = fs.readdirSync(dirPath);

  for (let filename of filenames) {
    if (filename.indexOf('.sanitizers.js') !== -1) {
      const serviceProviderId = path.basename(filename, '.sanitizers.js');

      serviceProviders[serviceProviderId] = {
        ...serviceProviders[serviceProviderId],
        sanitizers: await import(path.join(dirPath, filename)),
      };
    } else if (filename.indexOf('.json') !== -1) {
      const serviceProviderId = path.basename(filename, '.json');

      serviceProviders[serviceProviderId] = {
        ...serviceProviders[serviceProviderId],
        ...JSON.parse(fs.readFileSync(path.join(dirPath, filename))),
      };
    }
  }

  return serviceProviders;
}
