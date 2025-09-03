import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

import config from 'config';

import * as exposedFilters from '../extract/exposedFilters.js';

import Service from './service.js';
import SourceDocument from './sourceDocument.js';
import Terms from './terms.js';

export const DECLARATIONS_PATH = './declarations';
const declarationsPath = path.resolve(process.cwd(), config.get('@opentermsarchive/engine.collectionPath'), DECLARATIONS_PATH);

const JSON_EXT = '.json';
const JS_EXT = '.js';
const HISTORY_SUFFIX = '.history';
const FILTERS_SUFFIX = '.filters';

export async function load(servicesIdsToLoad = []) {
  const allServicesIds = await getDeclaredServicesIds();
  const servicesIds = servicesIdsToLoad.length ? allServicesIds.filter(serviceId => servicesIdsToLoad.includes(serviceId)) : allServicesIds;
  const services = {};

  await Promise.all(servicesIds.map(async serviceId => {
    services[serviceId] = await createServiceFromDeclaration(serviceId);
  }));

  return services;
}

export async function createServiceFromDeclaration(serviceId) {
  const { name, terms: termsDeclarations } = await loadServiceDeclaration(serviceId);
  const service = new Service({ id: serviceId, name });

  await Promise.all(Object.entries(termsDeclarations).map(async ([ termsType, termsDeclaration ]) => {
    const sourceDocuments = await createSourceDocuments(service.id, termsDeclaration);

    service.addTerms(new Terms({ service, type: termsType, sourceDocuments }));
  }));

  return service;
}

export async function loadServiceDeclaration(serviceId) {
  const filePath = path.join(declarationsPath, `${serviceId}${JSON_EXT}`);
  const rawServiceDeclaration = await fs.readFile(filePath);

  try {
    return JSON.parse(rawServiceDeclaration);
  } catch (error) {
    throw new Error(`The "${serviceId}" service declaration is malformed and cannot be parsed in ${filePath}`);
  }
}

export async function createSourceDocuments(serviceId, termsDeclaration) {
  const serviceFilters = await loadServiceFilters(serviceId);

  if (!termsDeclaration.combine) {
    return [new SourceDocument({
      location: termsDeclaration.fetch,
      executeClientScripts: termsDeclaration.executeClientScripts,
      contentSelectors: termsDeclaration.select,
      insignificantContentSelectors: termsDeclaration.remove,
      filters: await getServiceFilters(serviceFilters, termsDeclaration.filter),
    })];
  }

  return Promise.all(termsDeclaration.combine.map(async sourceDocumentDeclaration =>
    new SourceDocument({
      location: sourceDocumentDeclaration.fetch ?? termsDeclaration.fetch,
      executeClientScripts: sourceDocumentDeclaration.executeClientScripts ?? termsDeclaration.executeClientScripts,
      contentSelectors: sourceDocumentDeclaration.select ?? termsDeclaration.select,
      insignificantContentSelectors: sourceDocumentDeclaration.remove ?? termsDeclaration.remove,
      filters: await getServiceFilters(serviceFilters, sourceDocumentDeclaration.filter ?? termsDeclaration.filter),
    })));
}

export async function loadServiceFilters(serviceId) {
  const serviceFiltersPath = path.join(declarationsPath, `${serviceId}${FILTERS_SUFFIX}${JS_EXT}`);

  if (await fileExists(serviceFiltersPath)) {
    return import(pathToFileURL(serviceFiltersPath));
  }

  return {};
}

function parseFilterItem(filterItem) {
  if (typeof filterItem === 'string') {
    return { filterName: filterItem, filterParams: undefined };
  }

  if (typeof filterItem === 'object' && filterItem !== null) {
    const [ filterNameEntry, filterParamsEntry ] = Object.entries(filterItem)[0];

    return { filterName: filterNameEntry, filterParams: filterParamsEntry };
  }

  return { filterName: undefined, filterParams: undefined };
}

function createWrappedFilter(baseFunction, filterName, filterParams) {
  if (!baseFunction) {
    return;
  }

  if (filterParams) {
    const wrappedFilter = (webPageDOM, context) => baseFunction(webPageDOM, filterParams, context);

    Object.defineProperty(wrappedFilter, 'name', { value: filterName });

    return wrappedFilter;
  }

  return baseFunction;
}

export function getServiceFilters(serviceFilters, declaredFilters) {
  if (!declaredFilters) {
    return;
  }

  const filters = declaredFilters.reduce((filters, filterItem) => {
    const { filterName, filterParams } = parseFilterItem(filterItem);

    if (!filterName) {
      return filters;
    }

    const baseFunction = exposedFilters[filterName] || serviceFilters[filterName];
    const filterFunction = createWrappedFilter(baseFunction, filterName, filterParams);

    if (filterFunction) {
      filters.push(filterFunction);
    }

    return filters;
  }, []);

  return filters.length ? filters : undefined;
}

export async function getDeclaredServicesIds() {
  const fileNames = await fs.readdir(declarationsPath);

  return fileNames
    .filter(fileName => fileName.endsWith(JSON_EXT) && !fileName.includes(`${HISTORY_SUFFIX}${JSON_EXT}`))
    .map(fileName => path.basename(fileName, JSON_EXT));
}

export async function loadWithHistory(servicesIds = []) {
  const services = await load(servicesIds);

  await Promise.all(Object.keys(services).map(serviceId => addHistoryToService(services[serviceId])));

  return services;
}

async function addHistoryToService(service) {
  const { declarations, filters } = await loadServiceHistoryFiles(service.id);

  await Promise.all(Object.entries(declarations).map(([ termsType, declarationEntries ]) => addTermsHistory(service, service.id, termsType, declarationEntries, filters)));
}

async function addTermsHistory(service, serviceId, termsType, declarationEntries, filters) {
  const declaredFilters = [...new Set(declarationEntries.flatMap(declarationEntrie => declarationEntrie.filter))].filter(Boolean);
  const historyDates = extractHistoryDates({ termsTypeDeclarationEntries: declarationEntries, filters, declaredFilters });
  const latestValidTerms = declarationEntries.find(entry => !entry.validUntil);

  await Promise.all(historyDates.map(date => createTermsForDate(service, serviceId, termsType, date, declarationEntries, filters, latestValidTerms)));
}

async function createTermsForDate(service, serviceId, termsType, date, declarationEntries, filters, latestValidTerms) {
  const declaration = declarationEntries.find(entry => new Date(date) <= new Date(entry.validUntil)) || latestValidTerms;
  const actualFilters = resolveFiltersForDate(date, declaration.filter, filters);

  const sourceDocuments = await createHistorySourceDocuments(serviceId, declaration, actualFilters);

  service.addTerms(new Terms({
    service,
    type: termsType,
    sourceDocuments,
    validUntil: date,
  }));
}

function resolveFiltersForDate(date, declaredFilters, filters) {
  return declaredFilters?.map(filterItem => {
    const { filterName, filterParams } = parseFilterItem(filterItem);

    if (!filterName) {
      return;
    }

    const filterHistory = filters[filterName];
    const historicalFilter = filterHistory?.find(entry => new Date(date) <= new Date(entry.validUntil));
    const currentFilter = filterHistory?.find(entry => !entry.validUntil);
    const filter = (historicalFilter || currentFilter)?.filter;

    return createWrappedFilter(filter, filterName, filterParams);
  });
}

async function createHistorySourceDocuments(serviceId, termsDeclaration, actualFilters) {
  const serviceFilters = await loadServiceFilters(serviceId);

  if (!termsDeclaration.combine) {
    return [new SourceDocument({
      location: termsDeclaration.fetch,
      executeClientScripts: termsDeclaration.executeClientScripts,
      contentSelectors: termsDeclaration.select,
      insignificantContentSelectors: termsDeclaration.remove,
      filters: actualFilters,
    })];
  }

  return Promise.all(termsDeclaration.combine.map(async sourceDocument => {
    const filters = await getServiceFilters(serviceFilters, sourceDocument.filter) || actualFilters;

    return new SourceDocument({
      location: sourceDocument.fetch || termsDeclaration.fetch,
      executeClientScripts: sourceDocument.executeClientScripts ?? termsDeclaration.executeClientScripts,
      contentSelectors: sourceDocument.select || termsDeclaration.select,
      insignificantContentSelectors: sourceDocument.remove || termsDeclaration.remove,
      filters,
    });
  }));
}

function extractHistoryDates({ filters, declaredFilters, termsTypeDeclarationEntries }) {
  const filterDates = Object.entries(filters)
    .filter(([filterName]) => declaredFilters.some(filterItem => {
      const { filterName: itemName } = parseFilterItem(filterItem);

      return itemName === filterName;
    }))
    .flatMap(([ , filterEntries ]) => filterEntries.map(({ validUntil }) => validUntil))
    .filter(Boolean);

  const declarationDates = termsTypeDeclarationEntries
    .map(({ validUntil }) => validUntil)
    .filter(Boolean);

  return [...new Set([ ...filterDates, ...declarationDates ])].sort((a, b) => new Date(a) - new Date(b));
}

function sortHistory(history = {}) {
  Object.values(history).forEach(entries => entries.sort((a, b) => new Date(a.validUntil) - new Date(b.validUntil)));
}

async function loadServiceHistoryFiles(serviceId) {
  const serviceDeclaration = await loadServiceDeclaration(serviceId);
  const filePaths = getHistoryFilePaths(serviceId);

  const [ serviceHistory, serviceFiltersHistory ] = await Promise.all([
    loadServiceHistory(filePaths.history),
    loadServiceFiltersHistory(filePaths.filtersHistory, filePaths.filters),
  ]);

  Object.entries(serviceDeclaration.terms).forEach(([ termsType, declaration ]) => {
    serviceHistory[termsType] = serviceHistory[termsType] || [];
    serviceHistory[termsType].push(declaration);
  });

  sortHistory(serviceHistory);
  sortHistory(serviceFiltersHistory);

  return { declarations: serviceHistory, filters: serviceFiltersHistory };
}

function getHistoryFilePaths(serviceId) {
  const basePath = path.join(declarationsPath, serviceId);

  return {
    history: `${basePath}${HISTORY_SUFFIX}${JSON_EXT}`,
    filters: `${basePath}${FILTERS_SUFFIX}${JS_EXT}`,
    filtersHistory: `${basePath}${FILTERS_SUFFIX}${HISTORY_SUFFIX}${JS_EXT}`,
  };
}

async function loadServiceHistory(historyFilePath) {
  if (!(await fileExists(historyFilePath))) return {};

  try {
    return JSON.parse(await fs.readFile(historyFilePath));
  } catch (error) {
    const fileName = path.basename(historyFilePath, JSON_EXT);

    throw new Error(`The "${fileName}" service declaration is malformed and cannot be parsed in ${historyFilePath}`);
  }
}

async function loadServiceFiltersHistory(filtersHistoryPath, filtersPath) {
  const filtersHistory = {};

  if (await fileExists(filtersHistoryPath)) {
    const historyModule = await import(pathToFileURL(filtersHistoryPath));

    Object.assign(filtersHistory, historyModule);
  }

  if (await fileExists(filtersPath)) {
    const filtersModule = await import(pathToFileURL(filtersPath));

    Object.entries(filtersModule).forEach(([ filterName, filter ]) => {
      filtersHistory[filterName] = filtersHistory[filterName] || [];
      filtersHistory[filterName].push({ filter });
    });
  }

  return filtersHistory;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);

    return true;
  } catch {
    return false;
  }
}
