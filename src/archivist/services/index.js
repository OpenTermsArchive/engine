import fsApi from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

import config from 'config';

import Document from './document.js';
import Service from './service.js';
import Terms from './terms.js';

const fs = fsApi.promises;
const declarationsPath = path.resolve(process.cwd(), config.get('services.declarationsPath'));

export async function load(servicesIdsToLoad = []) {
  let servicesIds = await getDeclaredServicesIds();

  if (servicesIdsToLoad.length) {
    servicesIds = servicesIds.filter(serviceId => serviceId.match(new RegExp(`^${servicesIdsToLoad.join('|')}$`, 'g')));
  }

  const services = {};

  await Promise.all(servicesIds.map(async serviceId => {
    const { name, documents: documentsDeclaration } = await loadServiceDeclaration(serviceId);

    const service = new Service({ id: serviceId, name });

    await Promise.all(Object.keys(documentsDeclaration).map(termsType => loadServiceDocument(service, termsType, documentsDeclaration[termsType])));

    services[serviceId] = service;
  }));

  return services;
}

async function loadServiceDeclaration(serviceId) {
  const jsonDeclarationFilePath = path.join(declarationsPath, `${serviceId}.json`);
  const rawServiceDeclaration = await fs.readFile(jsonDeclarationFilePath);

  try {
    return JSON.parse(rawServiceDeclaration);
  } catch (error) {
    throw new Error(`The "${serviceId}" service declaration is malformed and cannot be parsed in ${jsonDeclarationFilePath}`);
  }
}

async function loadServiceFilters(serviceId, filterNames) {
  if (!filterNames) {
    return;
  }

  const filterFilePath = `${serviceId}.filters.js`;
  const serviceFilters = await import(pathToFileURL(path.join(declarationsPath, filterFilePath))); // eslint-disable-line no-await-in-loop

  return filterNames.map(filterName => serviceFilters[filterName]);
}

async function loadServiceDocument(service, termsType, termsTypeDeclaration) {
  const { filter: filterNames, fetch: location, executeClientScripts, select: contentSelectors, remove: noiseSelectors, combine } = termsTypeDeclaration;

  const documents = [];

  const filters = await loadServiceFilters(service.id, filterNames);

  if (!combine) {
    documents.push(new Document({ location, executeClientScripts, contentSelectors, noiseSelectors, filters }));
  } else {
    for (const document of combine) {
      const { filter: pageFilterNames, fetch: pageLocation, executeClientScripts: pageExecuteClientScripts, select: pageContentSelectors, remove: pageNoiseSelectors } = document;

      const pageFilters = await loadServiceFilters(service.id, pageFilterNames); // eslint-disable-line no-await-in-loop

      documents.push(new Document({
        location: pageLocation || location,
        executeClientScripts: (pageExecuteClientScripts === undefined || pageExecuteClientScripts === null ? executeClientScripts : pageExecuteClientScripts),
        contentSelectors: pageContentSelectors || contentSelectors,
        noiseSelectors: pageNoiseSelectors || noiseSelectors,
        filters: pageFilters || filters,
      }));
    }
  }

  service.addTerms(new Terms({ service, termsType, documents }));
}

async function getDeclaredServicesIds() {
  const fileNames = await fs.readdir(declarationsPath);

  const servicesFileNames = fileNames.filter(fileName => path.extname(fileName) == '.json' && !fileName.includes('.history.json'));

  return servicesFileNames.map(serviceFileName => path.basename(serviceFileName, '.json'));
}

export async function loadWithHistory(servicesIds = []) {
  const services = await load(servicesIds);

  for (const serviceId of Object.keys(services)) {
    const { declarations, filters } = await loadServiceHistoryFiles(serviceId); // eslint-disable-line no-await-in-loop

    for (const termsType of Object.keys(declarations)) {
      const termsTypeDeclarationEntries = declarations[termsType];
      const filterNames = [...new Set(termsTypeDeclarationEntries.flatMap(declaration => declaration.filter))].filter(Boolean);
      const allHistoryDates = extractHistoryDates({ termsTypeDeclarationEntries, filters, filterNames });

      const latestValidTerms = termsTypeDeclarationEntries.find(entry => !entry.validUntil);

      allHistoryDates.forEach(async date => {
        const declarationForThisDate = termsTypeDeclarationEntries.find(entry => new Date(date) <= new Date(entry.validUntil)) || latestValidTerms;
        const { filter: declarationForThisDateFilterNames, combine } = declarationForThisDate;

        const documents = [];
        let actualFilters;

        if (declarationForThisDateFilterNames) {
          actualFilters = declarationForThisDateFilterNames.map(filterName => {
            const currentlyValidFilters = filters[filterName].find(entry => !entry.validUntil);
            const validFilterForThisDate = filters[filterName].find(entry => new Date(date) <= new Date(entry.validUntil))
              || currentlyValidFilters;

            return validFilterForThisDate.filter;
          });
        }

        if (!combine) {
          documents.push(new Document({
            location: declarationForThisDate.fetch,
            executeClientScripts: declarationForThisDate.executeClientScripts,
            contentSelectors: declarationForThisDate.select,
            noiseSelectors: declarationForThisDate.remove,
            filters: actualFilters,
          }));
        } else {
          for (const document of combine) {
            const { filter: pageFilterNames, fetch: pageLocation, executeClientScripts: pageExecuteClientScripts, select: pageContentSelectors, remove: pageNoiseSelectors } = document;

            const pageFilters = await loadServiceFilters(serviceId, pageFilterNames); // eslint-disable-line no-await-in-loop

            documents.push(new Document({
              location: pageLocation || declarationForThisDate.fetch,
              executeClientScripts: (pageExecuteClientScripts === undefined || pageExecuteClientScripts === null ? declarationForThisDate.executeClientScripts : pageExecuteClientScripts),
              contentSelectors: pageContentSelectors || declarationForThisDate.select,
              noiseSelectors: pageNoiseSelectors || declarationForThisDate.remove,
              filters: pageFilters || actualFilters,
            }));
          }
        }

        services[serviceId].addTerms(new Terms({
          service: services[serviceId],
          termsType,
          documents,
          validUntil: date,
        }));
      });
    }
  }

  return services;
}

function extractHistoryDates({ filters, filterNames, termsTypeDeclarationEntries }) {
  const allHistoryDates = [];

  Object.keys(filters).forEach(filterName => {
    if (filterNames.includes(filterName)) {
      filters[filterName].forEach(({ validUntil }) => allHistoryDates.push(validUntil));
    }
  });

  termsTypeDeclarationEntries.forEach(({ validUntil }) => allHistoryDates.push(validUntil));

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
  const serviceFiltersHistoryFileName = path.join(declarationsPath, `${serviceId}.filters.history.js`);

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

  Object.keys(serviceDeclaration.documents).forEach(termsType => {
    serviceHistory[termsType] = serviceHistory[termsType] || [];
    serviceHistory[termsType].push(serviceDeclaration.documents[termsType]);
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
    declarations: serviceHistory || {},
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
