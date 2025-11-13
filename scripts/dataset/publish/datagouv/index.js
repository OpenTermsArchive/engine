import config from 'config';

import logger from '../../logger/index.js';

import { updateDatasetMetadata, uploadResource, updateResourceMetadata, getDatasetUrl } from './dataset.js';

const PRODUCTION_API_BASE_URL = 'https://www.data.gouv.fr/api/1';
const DEMO_API_BASE_URL = 'https://demo.data.gouv.fr/api/1';

function loadConfiguration() {
  const apiKey = process.env.OTA_ENGINE_DATAGOUV_API_KEY;

  if (!apiKey) {
    throw new Error('OTA_ENGINE_DATAGOUV_API_KEY environment variable is required for data.gouv.fr publishing');
  }

  const datasetId = config.get('@opentermsarchive/engine.dataset.datagouv.datasetId');

  if (!datasetId) {
    throw new Error('datasetId is required in config at @opentermsarchive/engine.dataset.datagouv.datasetId. Run "node scripts/dataset/publish/datagouv/create-dataset.js" to create a dataset first.');
  }

  const useDemo = config.get('@opentermsarchive/engine.dataset.datagouv.useDemo');
  const apiBaseUrl = useDemo ? DEMO_API_BASE_URL : PRODUCTION_API_BASE_URL;

  if (useDemo) {
    logger.warn('Using demo.data.gouv.fr environment for testing');
  }

  const headers = { 'X-API-KEY': apiKey };

  return { datasetId, apiBaseUrl, headers };
}

export default async function publish({ archivePath, releaseDate, stats }) {
  const config = loadConfiguration();

  await updateDatasetMetadata({ ...config, releaseDate, stats });

  const { resourceId, fileName } = await uploadResource({ ...config, archivePath });

  await updateResourceMetadata({ ...config, resourceId, fileName });

  const datasetUrl = await getDatasetUrl({ ...config });

  return datasetUrl;
}
