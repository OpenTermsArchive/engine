import fsApi from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

import config from 'config';
import simpleGit from 'simple-git';

import Document from './document.js';
import Service from './service.js';

const fs = fsApi.promises;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_DECLARATIONS_PATH = path.resolve(__dirname, '../../..', config.get('serviceDeclarationsPath'));


export async function load() {
  const services = {};
  const fileNames = await fs.readdir(SERVICE_DECLARATIONS_PATH);
  const serviceFileNames = fileNames.filter(fileName => path.extname(fileName) == '.json' && !fileName.includes('.history.json'));

  for (const fileName of serviceFileNames) {
    const serviceDeclaration = JSON.parse(await fs.readFile(path.join(SERVICE_DECLARATIONS_PATH, fileName))); // eslint-disable-line no-await-in-loop

    const service = new Service({
      id: path.basename(fileName, '.json'),
      name: serviceDeclaration.name
    });

    services[service.id] = service;

    for (const documentType of Object.keys(serviceDeclaration.documents)) {
      const {
        filter: filterNames,
        fetch: location,
        select: contentSelectors,
        remove: noiseSelectors
      } = serviceDeclaration.documents[documentType];

      let filters;
      if (filterNames) {
        const filterFilePath = fileName.replace('.json', '.filters.js');
        const serviceFilters = await import(pathToFileURL(path.join(SERVICE_DECLARATIONS_PATH, filterFilePath))); // eslint-disable-line no-await-in-loop
        filters = filterNames.map(filterName => serviceFilters[filterName]);
      }

      const document = new Document({
        service,
        type: documentType,
        location,
        contentSelectors,
        noiseSelectors,
        filters,
      });

      services[service.id].documents[documentType] = {
        latest: document
      };
    }
  }

  return services;
}


      services[service.id] = service;

      for (const documentType of Object.keys(serviceDeclaration.documents)) {
        const {
          filter: filterNames,
          fetch: location,
          select: contentSelectors,
          remove: noiseSelectors
        } = serviceDeclaration.documents[documentType];

        let filters;
        if (filterNames) {
          const filterFilePath = fileName.replace('.json', '.filters.js');
          const serviceFilters = await import(pathToFileURL(path.join(SERVICE_DECLARATIONS_PATH, filterFilePath))); // eslint-disable-line no-await-in-loop
          filters = filterNames.map(filterName => serviceFilters[filterName]);
        }

        const document = new Document({
          service: {
            id: service.id,
            name: service.name
          },
          type: documentType,
          location,
          contentSelectors,
          noiseSelectors,
          filters,
        });

        services[service.id].documents[documentType] = {
          latest: document,
          history: [ document ]
        };
      }
    }

    return services;
  }


export async function getIdsOfModified() {
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const rootPath = path.join(__dirname, '../../../');

  const git = simpleGit(rootPath, { maxConcurrentProcesses: 1 });
  const committedFiles = await git.diff([ '--name-only', 'master...HEAD', '--', 'services/*.json' ]);
  const status = await git.status();
  const modifiedFiles = [
    ...status.not_added, // Files created but not already in staged area
    ...status.modified, // Files modified
    ...status.created, // Files created and in the staged area
    ...status.renamed.map(({ to }) => to), // Files renamed
    ...committedFiles.trim().split('\n') // Files committed
  ];

  return modifiedFiles
    .filter(fileName => fileName.match(/services.*\.json/))
    .map(filePath => path.basename(filePath, '.json'));
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
  }
}
