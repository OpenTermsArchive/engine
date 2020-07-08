import fsApi from 'fs';
const fs = fsApi.promises;
import path from 'path';

export default async function loadServiceDeclarations(dirPath) {
  const services = {};

  const filenames = await fs.readdir(dirPath);

  for (let filename of filenames) {
    if (filename.indexOf('.filters.js') !== -1) {
      const serviceId = path.basename(filename, '.filters.js');

      services[serviceId] = {
        ...services[serviceId],
        filters: await import(path.join(dirPath, filename)),
      };
    } else if (filename.indexOf('.json') !== -1) {
      const serviceId = path.basename(filename, '.json');

      services[serviceId] = {
        ...services[serviceId],
        ...JSON.parse(await fs.readFile(path.join(dirPath, filename))),
      };
    }
  }

  return services;
}
