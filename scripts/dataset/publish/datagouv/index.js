import config from 'config';

import * as readme from '../../assets/README.template.js';
import { createModuleLogger } from '../../logger/index.js';

import { updateDatasetMetadata, uploadResource, replaceResourceFile, updateResourceMetadata, getDataset, getOrganization, findDatasetByTitle, createDataset } from './dataset.js';

const logger = createModuleLogger('datagouv');

const PRODUCTION_API_BASE_URL = 'https://www.data.gouv.fr/api/1';
const DEMO_API_BASE_URL = 'https://demo.data.gouv.fr/api/1';
const DATASET_LICENSE = 'odc-odbl';

export default async function publish({ archivePath, stats }) {
  const { datasetId, organizationIdOrSlug, apiBaseUrl, headers, datasetTitle, frequency } = loadConfiguration();
  const description = readme.body(stats);

  const dataset = datasetId
    ? await getDataset({ apiBaseUrl, headers, datasetId })
    : await ensureDatasetExists({ apiBaseUrl, headers, organizationIdOrSlug, datasetTitle, description, frequency });

  await updateDatasetMetadata({ apiBaseUrl, headers, datasetId: dataset.id, title: datasetTitle, description, stats, frequency });

  const { resourceId, fileName } = await handleResourceUpload({ apiBaseUrl, headers, datasetId: dataset.id, dataset, archivePath });

  await updateResourceMetadata({ apiBaseUrl, headers, datasetId: dataset.id, resourceId, fileName });

  logger.info(`Dataset published successfully: ${dataset.page}`);

  return dataset.page;
}

function loadConfiguration() {
  const apiKey = process.env.OTA_ENGINE_DATAGOUV_API_KEY;

  if (!apiKey) {
    throw new Error('OTA_ENGINE_DATAGOUV_API_KEY environment variable is required for data.gouv.fr publishing');
  }

  const datasetId = config.has('@opentermsarchive/engine.dataset.datagouv.datasetId') && config.get('@opentermsarchive/engine.dataset.datagouv.datasetId');
  const organizationIdOrSlug = config.has('@opentermsarchive/engine.dataset.datagouv.organizationIdOrSlug') && config.get('@opentermsarchive/engine.dataset.datagouv.organizationIdOrSlug');

  if (!datasetId && !organizationIdOrSlug) {
    throw new Error('Either "datasetId" or "organizationIdOrSlug" is required in config at @opentermsarchive/engine.dataset.datagouv');
  }

  const datasetTitle = config.get('@opentermsarchive/engine.dataset.title');

  if (!datasetTitle) {
    throw new Error('"title" is required in config at @opentermsarchive/engine.dataset');
  }

  const frequency = config.has('@opentermsarchive/engine.dataset.datagouv.frequency') && config.get('@opentermsarchive/engine.dataset.datagouv.frequency');

  if (!frequency) {
    throw new Error('"frequency" is required in config at @opentermsarchive/engine.dataset.datagouv');
  }

  const useDemo = config.has('@opentermsarchive/engine.dataset.datagouv.useDemo') && config.get('@opentermsarchive/engine.dataset.datagouv.useDemo');
  const apiBaseUrl = useDemo ? DEMO_API_BASE_URL : PRODUCTION_API_BASE_URL;

  if (useDemo) {
    logger.warn('Using demo.data.gouv.fr environment for testing');
  }

  const headers = { 'X-API-KEY': apiKey };

  return { datasetId, organizationIdOrSlug, apiBaseUrl, headers, datasetTitle, frequency };
}

async function ensureDatasetExists({ apiBaseUrl, headers, organizationIdOrSlug, datasetTitle, description, frequency }) {
  const organization = await getOrganization({ apiBaseUrl, headers, organizationIdOrSlug });
  let dataset = await findDatasetByTitle({ apiBaseUrl, headers, organizationId: organization.id, title: datasetTitle });

  if (!dataset) {
    dataset = await createDataset({ apiBaseUrl, headers, organizationId: organization.id, title: datasetTitle, description, license: DATASET_LICENSE, frequency });
  }

  return dataset;
}

function handleResourceUpload({ apiBaseUrl, headers, datasetId, dataset, archivePath }) {
  if (dataset?.resources?.length > 0) {
    const existingResource = dataset.resources[0];

    logger.info(`Found existing resource: ${existingResource.title} (ID: ${existingResource.id})`);

    return replaceResourceFile({ apiBaseUrl, headers, datasetId, resourceId: existingResource.id, archivePath });
  }

  return uploadResource({ apiBaseUrl, headers, datasetId, archivePath });
}
