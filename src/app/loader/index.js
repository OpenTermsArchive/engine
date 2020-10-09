import fsApi from 'fs';
import path from 'path';
import {pathToFileURL} from 'url';

const fs = fsApi.promises;

export default async function loadServiceDeclarations(dirPath) {
  const services = {};

  const filenames = await fs.readdir(dirPath);

  for (const filename of filenames) {
    if (filename.indexOf('.filters.js') !== -1) {
      const serviceId = path.basename(filename, '.filters.js');

      services[serviceId] = {
        ...services[serviceId],
        filters: await import(pathToFileURL(path.join(dirPath, filename))), // eslint-disable-line no-await-in-loop
      };
    } else if (filename.indexOf('.json') !== -1) {
      const serviceId = path.basename(filename, '.json');

      services[serviceId] = {
        ...services[serviceId],
        ...JSON.parse(await fs.readFile(path.join(dirPath, filename))), // eslint-disable-line no-await-in-loop
      };
    }
  }

  return services;
}
