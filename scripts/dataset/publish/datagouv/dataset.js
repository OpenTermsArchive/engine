import fsApi from 'fs';
import path from 'path';

import FormData from 'form-data';
import nodeFetch from 'node-fetch';

import * as readme from '../../assets/README.template.js';
import logger from '../../logger/index.js';

const DATASET_LICENSE = 'odc-odbl';
const DEFAULT_RESOURCE_DESCRIPTION = 'See README.md inside the archive for dataset structure and usage information.';

export async function updateDatasetMetadata({ apiBaseUrl, headers, datasetId, releaseDate, stats }) {
  const updatePayload = {
    title: readme.title({ releaseDate }),
    description: readme.body(stats),
    license: DATASET_LICENSE,
  };

  if (stats?.firstVersionDate && stats?.lastVersionDate) {
    updatePayload.temporal_coverage = {
      start: stats.firstVersionDate.toISOString(),
      end: stats.lastVersionDate.toISOString(),
    };
  }

  const updateResponse = await nodeFetch(`${apiBaseUrl}/datasets/${datasetId}/`, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updatePayload),
  });

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();

    throw new Error(`Failed to update dataset metadata: ${updateResponse.status} ${updateResponse.statusText} - ${errorText}`);
  }
}

export async function uploadResource({ apiBaseUrl, headers, datasetId, archivePath }) {
  logger.info('Uploading dataset archive…');

  const formData = new FormData();
  const fileName = path.basename(archivePath);
  const fileStats = fsApi.statSync(archivePath);

  formData.append('file', fsApi.createReadStream(archivePath), {
    filename: fileName,
    contentType: 'application/zip',
    knownLength: fileStats.size,
  });

  const uploadResponse = await nodeFetch(`${apiBaseUrl}/datasets/${datasetId}/upload/`, {
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

export async function updateResourceMetadata({ apiBaseUrl, headers, datasetId, resourceId, fileName }) {
  logger.info('Updating resource metadata…');

  const resourceUpdateResponse = await nodeFetch(`${apiBaseUrl}/datasets/${datasetId}/resources/${resourceId}/`, {
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

export async function getDatasetUrl({ apiBaseUrl, headers, datasetId }) {
  const datasetResponse = await nodeFetch(`${apiBaseUrl}/datasets/${datasetId}/`, {
    method: 'GET',
    headers: { ...headers },
  });

  if (!datasetResponse.ok) {
    const errorText = await datasetResponse.text();

    throw new Error(`Failed to retrieve dataset URL: ${datasetResponse.status} ${datasetResponse.statusText} - ${errorText}`);
  }

  const datasetData = await datasetResponse.json();
  const datasetUrl = datasetData.page;

  return datasetUrl;
}
