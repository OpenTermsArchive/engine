import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

import config from 'config';

import Service from './service.js';
import SourceDocument from './sourceDocument.js';
import Terms from './terms.js';

export const DECLARATIONS_PATH = './declarations';
const declarationsPath = path.resolve(process.cwd(), config.get('@opentermsarchive/engine.collectionPath'), DECLARATIONS_PATH);

export async function load(servicesIdsToLoad = []) {
  let servicesIds = await getDeclaredServicesIds();

  if (servicesIdsToLoad.length) {
    servicesIds = servicesIds.filter(serviceId => serviceId.match(new RegExp(`^${servicesIdsToLoad.join('|')}$`, 'g')));
  }

  const services = {};

  await Promise.all(servicesIds.map(async serviceId => {
    const { name, terms } = await loadServiceDeclaration(serviceId);

    const service = new Service({ id: serviceId, name });

    await Promise.all(Object.keys(terms).map(termsType => loadServiceDocument(service, termsType, terms[termsType])));

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
  const { filter: filterNames, fetch: location, executeClientScripts, select: contentSelectors, remove: insignificantContentSelectors, combine } = termsTypeDeclaration;

  const sourceDocuments = [];

  const filters = await loadServiceFilters(service.id, filterNames);

  if (!combine) {
    sourceDocuments.push(new SourceDocument({ location, executeClientScripts, contentSelectors, insignificantContentSelectors, filters }));
  } else {
    for (const sourceDocument of combine) {
      const {
        filter: sourceDocumentFilterNames,
        fetch: sourceDocumentLocation,
        executeClientScripts: sourceDocumentExecuteClientScripts,
        select: sourceDocumentContentSelectors,
        remove: sourceDocumentInsignificantContentSelectors,
      } = sourceDocument;

      const sourceDocumentFilters = await loadServiceFilters(service.id, sourceDocumentFilterNames); // eslint-disable-line no-await-in-loop

      sourceDocuments.push(new SourceDocument({
        location: sourceDocumentLocation || location,
        executeClientScripts: (sourceDocumentExecuteClientScripts === undefined || sourceDocumentExecuteClientScripts === null ? executeClientScripts : sourceDocumentExecuteClientScripts),
        contentSelectors: sourceDocumentContentSelectors || contentSelectors,
        insignificantContentSelectors: sourceDocumentInsignificantContentSelectors || insignificantContentSelectors,
        filters: sourceDocumentFilters || filters,
      }));
    }
  }

  service.addTerms(new Terms({ service, type: termsType, sourceDocuments }));
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

        const sourceDocuments = [];
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
          sourceDocuments.push(new SourceDocument({
            location: declarationForThisDate.fetch,
            executeClientScripts: declarationForThisDate.executeClientScripts,
            contentSelectors: declarationForThisDate.select,
            insignificantContentSelectors: declarationForThisDate.remove,
            filters: actualFilters,
          }));
        } else {
          for (const sourceDocument of combine) {
            const {
              filter: sourceDocumentFilterNames,
              fetch: sourceDocumentLocation,
              executeClientScripts: sourceDocumentExecuteClientScripts,
              select: sourceDocumentContentSelectors,
              remove: sourceDocumentInsignificantContentSelectors,
            } = sourceDocument;

            const sourceDocumentFilters = await loadServiceFilters(serviceId, sourceDocumentFilterNames); // eslint-disable-line no-await-in-loop

            sourceDocuments.push(new SourceDocument({
              location: sourceDocumentLocation || declarationForThisDate.fetch,
              executeClientScripts: (sourceDocumentExecuteClientScripts === undefined || sourceDocumentExecuteClientScripts === null ? declarationForThisDate.executeClientScripts : sourceDocumentExecuteClientScripts),
              contentSelectors: sourceDocumentContentSelectors || declarationForThisDate.select,
              insignificantContentSelectors: sourceDocumentInsignificantContentSelectors || declarationForThisDate.remove,
              filters: sourceDocumentFilters || actualFilters,
            }));
          }
        }

        services[serviceId].addTerms(new Terms({
          service: services[serviceId],
          type: termsType,
          sourceDocuments,
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

  Object.keys(serviceDeclaration.terms).forEach(termsType => {
    serviceHistory[termsType] = serviceHistory[termsType] || [];
    serviceHistory[termsType].push(serviceDeclaration.terms[termsType]);
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
