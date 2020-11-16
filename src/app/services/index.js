import fsApi from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

import config from 'config';
import simpleGit from 'simple-git';

import DocumentDeclaration from './documentDeclaration.js';
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

      const document = new DocumentDeclaration({
        service,
        type: documentType,
        location,
        contentSelectors,
        noiseSelectors,
        filters,
      });

      services[service.id].addDocumentDeclaration(document);
    }
  }

  return services;
}

export async function loadWithHistory() {
  const services = await load();

  for (const serviceId of Object.keys(services)) {
    const { declaration, filters } = await loadServiceHistoryFiles(serviceId); // eslint-disable-line no-await-in-loop

    for (const documentType of Object.keys(declaration)) {
      const documenTypeDeclarationEntries = declaration[documentType];

      const filterNames = [ ...new Set(documenTypeDeclarationEntries.flatMap(declaration => declaration.filter)) ].filter(el => el);

      const allHistoryDates = extractHistoryDates({
        documenTypeDeclarationEntries,
        filters,
        filterNames
      });

      const currentlyValidDocumentDeclaration = documenTypeDeclarationEntries.find(entry => !entry.validUntil);

      allHistoryDates.forEach(date => {
        const declarationForThisDate = documenTypeDeclarationEntries.find(entry => new Date(date) <= new Date(entry.validUntil)) || currentlyValidDocumentDeclaration;
        const { filter: declarationForThisDateFilterNames } = declarationForThisDate;

        let actualFilters;
        if (declarationForThisDateFilterNames) {
          actualFilters = declarationForThisDateFilterNames.map(filterName => {
            const currentlyValidFilters = filters[filterName].find(entry => !entry.validUntil);
            const validFilterForThisDate = filters[filterName].find(entry => new Date(date) <= new Date(entry.validUntil)) || currentlyValidFilters;

            return validFilterForThisDate.fn;
          });
        }

        services[serviceId].addDocumentDeclaration(new DocumentDeclaration({
          service: services[serviceId],
          type: documentType,
          location: declarationForThisDate.fetch,
          contentSelectors: declarationForThisDate.select,
          noiseSelectors: declarationForThisDate.remove,
          filters: actualFilters,
          validUntil: date,
        }));
      });
    }
  }

  return services;
}

function extractHistoryDates({ filters, filterNames, documenTypeDeclarationEntries }) {
  const allHistoryDates = [];

  Object.keys(filters).forEach(filterName => {
    if (filterNames.includes(filterName)) {
      filters[filterName].forEach(({ validUntil }) => allHistoryDates.push(validUntil));
    }
  });

  documenTypeDeclarationEntries.forEach(({ validUntil }) => allHistoryDates.push(validUntil));

  const sortedDates = allHistoryDates.sort((a, b) => new Date(a) - new Date(b));
  const uniqSortedDates = [ ...new Set(sortedDates) ];
  return uniqSortedDates;
}

function sortHistory(history = {}) {
  Object.keys(history).forEach(entry => {
    history[entry].sort((a, b) => new Date(a.validUntil) - new Date(b.validUntil));
  });
}

async function loadServiceHistoryFiles(serviceId) {
  const serviceFileName = path.join(SERVICE_DECLARATIONS_PATH, `${serviceId}.json`);
  const serviceDeclaration = JSON.parse(await fs.readFile(serviceFileName));

  const serviceHistoryFileName = path.join(SERVICE_DECLARATIONS_PATH, `${serviceId}.history.json`);
  const serviceFiltersFileName = path.join(SERVICE_DECLARATIONS_PATH, `${serviceId}.filters.js`);
  const serviceFiltersHistoryFileName = path.join(SERVICE_DECLARATIONS_PATH, `${serviceId}.filters.history.js`);

  let serviceHistory = {};
  const serviceFiltersHistory = {};
  let serviceFiltersHistoryModule;

  if (await fileExists(serviceHistoryFileName)) {
    serviceHistory = JSON.parse(await fs.readFile(serviceHistoryFileName));
  }

  Object.keys(serviceDeclaration.documents).forEach(documentType => {
    serviceHistory[documentType] = serviceHistory[documentType] || [];
    serviceHistory[documentType].push(serviceDeclaration.documents[documentType]);
  });

  sortHistory(serviceHistory);

  if (await fileExists(serviceFiltersHistoryFileName)) {
    serviceFiltersHistoryModule = await import(pathToFileURL(serviceFiltersHistoryFileName));
    Object.keys(serviceFiltersHistoryModule).forEach(filterName => {
      serviceFiltersHistory[filterName] = serviceFiltersHistoryModule[filterName];
    });
  }

  if (await fileExists(serviceFiltersFileName)) {
    const serviceFilters = await import(pathToFileURL(serviceFiltersFileName));

    Object.keys(serviceFilters).forEach(filterName => {
      serviceFiltersHistory[filterName] = serviceFiltersHistory[filterName] || [];
      serviceFiltersHistory[filterName].push({ fn: serviceFilters[filterName] });
    });
  }

  sortHistory(serviceFiltersHistory);

  return {
    declaration: serviceHistory || {},
    filters: serviceFiltersHistory || {},
  };
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
