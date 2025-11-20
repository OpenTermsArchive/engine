import fsApi from 'fs';
import path from 'path';

import FormData from 'form-data';
import nodeFetch from 'node-fetch';

import { createModuleLogger } from '../../logger/index.js';

const logger = createModuleLogger('datagouv');

const DATASET_LICENSE = 'odc-odbl';
const DEFAULT_RESOURCE_DESCRIPTION = 'See README.md inside the archive for dataset structure and usage information.';

const routes = {
  dataset: (apiBaseUrl, datasetId) => `${apiBaseUrl}/datasets/${datasetId}/`,
  datasets: apiBaseUrl => `${apiBaseUrl}/datasets/`,
  datasetUpload: (apiBaseUrl, datasetId) => `${apiBaseUrl}/datasets/${datasetId}/upload/`,
  resource: (apiBaseUrl, datasetId, resourceId) => `${apiBaseUrl}/datasets/${datasetId}/resources/${resourceId}/`,
  resourceUpload: (apiBaseUrl, datasetId, resourceId) => `${apiBaseUrl}/datasets/${datasetId}/resources/${resourceId}/upload/`,
  organization: (apiBaseUrl, organizationIdOrSlug) => `${apiBaseUrl}/organizations/${organizationIdOrSlug}/`,
  organizationDatasets: (apiBaseUrl, organizationId) => `${apiBaseUrl}/organizations/${organizationId}/datasets/?page_size=100`,
};

export async function getOrganization({ apiBaseUrl, headers, organizationIdOrSlug }) {
  logger.info(`Fetching organization: ${organizationIdOrSlug}…`);

  const orgResponse = await nodeFetch(routes.organization(apiBaseUrl, organizationIdOrSlug), { headers });

  if (!orgResponse.ok) {
    const errorText = await orgResponse.text();

    throw new Error(`Failed to retrieve organization: ${orgResponse.status} ${orgResponse.statusText} - ${errorText}`);
  }

  const orgData = await orgResponse.json();

  logger.info(`Found organization: ${orgData.name} (ID: ${orgData.id})`);

  return orgData;
}

export async function getDataset({ apiBaseUrl, headers, datasetId }) {
  const datasetResponse = await nodeFetch(routes.dataset(apiBaseUrl, datasetId), { headers });

  if (!datasetResponse.ok) {
    const errorText = await datasetResponse.text();
    const error = new Error(`Failed to retrieve dataset: ${datasetResponse.status} ${datasetResponse.statusText} - ${errorText}`);

    error.statusCode = datasetResponse.status;
    throw error;
  }

  const datasetData = await datasetResponse.json();

  return datasetData;
}

export async function findDatasetByTitle({ apiBaseUrl, headers, organizationId, title }) {
  logger.info(`Searching for dataset with title "${title}" in organization…`);

  const searchResponse = await nodeFetch(routes.organizationDatasets(apiBaseUrl, organizationId), { headers });

  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();

    throw new Error(`Failed to search for datasets: ${searchResponse.status} ${searchResponse.statusText} - ${errorText}`);
  }

  const searchData = await searchResponse.json();

  const dataset = searchData.data.find(ds => ds.title === title);

  if (dataset) {
    logger.info(`Found existing dataset: ${dataset.title} (ID: ${dataset.id})`);

    return dataset;
  }

  logger.info('No existing dataset found with this title');

  return null;
}

export async function createDataset({ apiBaseUrl, headers, organizationId, title, description, license, frequency }) {
  logger.info(`Creating new dataset: ${title}…`);

  const createResponse = await nodeFetch(routes.datasets(apiBaseUrl), {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      description,
      organization: organizationId,
      license,
      frequency,
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();

    throw new Error(`Failed to create dataset: ${createResponse.status} ${createResponse.statusText} - ${errorText}`);
  }

  const dataset = await createResponse.json();

  logger.info(`Dataset created successfully: ${dataset.title} (ID: ${dataset.id})`);

  return dataset;
}

export async function updateDatasetMetadata({ apiBaseUrl, headers, datasetId, title, description, stats, frequency }) {
  const updatePayload = {
    title,
    description,
    license: DATASET_LICENSE,
    frequency,
  };

  if (stats?.firstVersionDate && stats?.lastVersionDate) {
    updatePayload.temporal_coverage = {
      start: stats.firstVersionDate.toISOString(),
      end: stats.lastVersionDate.toISOString(),
    };
  }

  const updateResponse = await nodeFetch(routes.dataset(apiBaseUrl, datasetId), {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updatePayload),
  });

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    const error = new Error(`Failed to update dataset metadata: ${updateResponse.status} ${updateResponse.statusText} - ${errorText}`);

    error.statusCode = updateResponse.status;
    throw error;
  }

  logger.info('Dataset metadata updated successfully');
}

export async function uploadResource({ apiBaseUrl, headers, datasetId, archivePath }) {
  logger.info('Uploading dataset archive…');

  const { formData, fileName } = createFormDataForFile(archivePath);

  const uploadResponse = await nodeFetch(routes.datasetUpload(apiBaseUrl, datasetId), {
    method: 'POST',
    headers: { ...formData.getHeaders(), ...headers },
    body: formData,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();

    throw new Error(`Failed to upload dataset file: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
  }

  const uploadResult = await uploadResponse.json();

  logger.info(`Dataset file uploaded successfully with resource ID: ${uploadResult.id}`);

  return { resourceId: uploadResult.id, fileName };
}

export async function replaceResourceFile({ apiBaseUrl, headers, datasetId, resourceId, archivePath }) {
  logger.info(`Replacing file for existing resource ID: ${resourceId}…`);

  const { formData, fileName } = createFormDataForFile(archivePath);

  const uploadResponse = await nodeFetch(routes.resourceUpload(apiBaseUrl, datasetId, resourceId), {
    method: 'POST',
    headers: { ...formData.getHeaders(), ...headers },
    body: formData,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();

    throw new Error(`Failed to replace resource file: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
  }

  const uploadResult = await uploadResponse.json();

  logger.info('Resource file replaced successfully');

  return { resourceId: uploadResult.id, fileName };
}

export async function updateResourceMetadata({ apiBaseUrl, headers, datasetId, resourceId, fileName }) {
  logger.info('Updating resource metadata…');

  const resourceUpdateResponse = await nodeFetch(routes.resource(apiBaseUrl, datasetId, resourceId), {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: fileName,
      description: DEFAULT_RESOURCE_DESCRIPTION,
      filetype: 'file',
      format: 'zip',
      mime: 'application/zip',
    }),
  });

  if (!resourceUpdateResponse.ok) {
    const errorText = await resourceUpdateResponse.text();

    throw new Error(`Failed to update resource metadata: ${resourceUpdateResponse.status} ${resourceUpdateResponse.statusText} - ${errorText}`);
  }

  logger.info('Resource metadata updated successfully');
}

function createFormDataForFile(archivePath) {
  const formData = new FormData();
  const fileName = path.basename(archivePath);
  const fileStats = fsApi.statSync(archivePath);

  formData.append('file', fsApi.createReadStream(archivePath), {
    filename: fileName,
    contentType: 'application/zip',
    knownLength: fileStats.size,
  });

  return { formData, fileName };
}
