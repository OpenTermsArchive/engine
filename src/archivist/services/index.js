import fsApi from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import config from 'config';

import DocumentDeclaration from './documentDeclaration.js';
import Service from './service.js';

const fs = fsApi.promises;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const declarationsPath = path.resolve(__dirname, '../../..', config.get('services.declarationsPath'));

export const DOCUMENT_TYPES = JSON.parse(fsApi.readFileSync(path.resolve(__dirname, './documentTypes.json')));

export async function load(servicesIds = []) {
  const services = {};
  const fileNames = await fs.readdir(declarationsPath);
  let serviceFileNames = fileNames.filter(fileName => path.extname(fileName) == '.json' && !fileName.includes('.history.json'));

  if (servicesIds.length) {
    serviceFileNames = serviceFileNames.filter(fileName => path.basename(fileName, '.json').match(new RegExp(`^${servicesIds.join('|')}$`, 'g')));
  }

  await Promise.all(serviceFileNames.map(async fileName => {
    const jsonDeclarationFilePath = path.join(declarationsPath, fileName);
    let serviceDeclaration;

    try {
      serviceDeclaration = JSON.parse(await fs.readFile(jsonDeclarationFilePath));
    } catch (e) {
      throw new Error(`The "${path.basename(fileName, '.json')}" service declaration is malformed and cannot be parsed in ${jsonDeclarationFilePath}`);
    }
    const service = new Service({
      id: path.basename(fileName, '.json'),
      name: serviceDeclaration.name,
    });

    services[service.id] = service;

    const documentNames = Object.keys(serviceDeclaration.documents);

    await Promise.all(documentNames.map(async documentName => {
      const documentType = serviceDeclaration.documents[documentName];
      const {
        filter: filterNames,
        fetch: location,
        executeClientScripts,
        select: contentSelectors,
        remove: noiseSelectors,
      } = documentType;

      let filters;

      if (filterNames) {
        const filterFilePath = fileName.replace('.json', '.filters.js');
        const serviceFilters = await import(pathToFileURL(path.join(declarationsPath, filterFilePath))); // eslint-disable-line no-await-in-loop

        filters = filterNames.map(filterName => serviceFilters[filterName]);
      }
      const document = new DocumentDeclaration({
        service,
        type: documentName,
        location,
        executeClientScripts,
        contentSelectors,
        noiseSelectors,
        filters,
      });

      services[service.id].addDocumentDeclaration(document);
    }));
  }));

  return services;
}

export async function loadWithHistory(servicesIds = []) {
  const services = await load(servicesIds);

  for (const serviceId of Object.keys(services)) {
    const { declaration, filters } = await loadServiceHistoryFiles(serviceId); // eslint-disable-line no-await-in-loop

    for (const documentType of Object.keys(declaration)) {
      const documenTypeDeclarationEntries = declaration[documentType];

      const filterNames = [...new Set(documenTypeDeclarationEntries.flatMap(declaration => declaration.filter))].filter(el => el);

      const allHistoryDates = extractHistoryDates({
        documenTypeDeclarationEntries,
        filters,
        filterNames,
      });

      const currentlyValidDocumentDeclaration = documenTypeDeclarationEntries.find(entry => !entry.validUntil);

      allHistoryDates.forEach(date => {
        const declarationForThisDate = documenTypeDeclarationEntries.find(entry => new Date(date) <= new Date(entry.validUntil)) || currentlyValidDocumentDeclaration;
        const { filter: declarationForThisDateFilterNames } = declarationForThisDate;

        let actualFilters;

        if (declarationForThisDateFilterNames) {
          actualFilters = declarationForThisDateFilterNames.map(filterName => {
            const currentlyValidFilters = filters[filterName].find(entry => !entry.validUntil);
            const validFilterForThisDate = filters[filterName].find(entry => new Date(date) <= new Date(entry.validUntil))
              || currentlyValidFilters;

            return validFilterForThisDate.filter;
          });
        }

        services[serviceId].addDocumentDeclaration(new DocumentDeclaration({
          service: services[serviceId],
          type: documentType,
          location: declarationForThisDate.fetch,
          executeClientScripts: declarationForThisDate.executeClientScripts,
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
  const uniqSortedDates = [...new Set(sortedDates)];

  return uniqSortedDates;
}

function sortHistory(history = {}) {
  Object.keys(history).forEach(entry => {
    history[entry].sort((a, b) => new Date(a.validUntil) - new Date(b.validUntil));
  });
}

async function loadServiceHistoryFiles(serviceId) {
  const serviceFileName = path.join(declarationsPath, `${serviceId}.json`);
  const jsonDeclarationFilePath = await fs.readFile(serviceFileName);
  let serviceDeclaration;

  try {
    serviceDeclaration = JSON.parse(jsonDeclarationFilePath);
  } catch (e) {
    throw new Error(`The "${path.basename(jsonDeclarationFilePath, '.json')}" service declaration is malformed and cannot be parsed in ${jsonDeclarationFilePath}`);
  }

  const serviceHistoryFileName = path.join(declarationsPath, `${serviceId}.history.json`);
  const serviceFiltersFileName = path.join(declarationsPath, `${serviceId}.filters.js`);
  const serviceFiltersHistoryFileName = path.join(
    declarationsPath,
    `${serviceId}.filters.history.js`,
  );

  let serviceHistory = {};
  const serviceFiltersHistory = {};
  let serviceFiltersHistoryModule;

  if (await fileExists(serviceHistoryFileName)) {
    try {
      serviceHistory = JSON.parse(await fs.readFile(serviceHistoryFileName));
    } catch (e) {
      throw new Error(`The "${path.basename(serviceHistoryFileName, '.json')}" service declaration is malformed and cannot be parsed in ${serviceHistoryFileName}`);
    }
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
      serviceFiltersHistory[filterName].push({ filter: serviceFilters[filterName] });
    });
  }

  sortHistory(serviceFiltersHistory);

  return {
    declaration: serviceHistory || {},
    filters: serviceFiltersHistory || {},
  };
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
