import path from 'path';
import fsApi from 'fs';
const fs = fsApi.promises;

import config from 'config';
import async from 'async';

import * as git from './git.js';
import { TYPES as DOCUMENT_TYPES } from '../types.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const DATABASE_DIRECTORY = path.resolve(__dirname, '../..', config.get('history.dataPath'));
export const SNAPSHOTS_DIRECTORY = `${DATABASE_DIRECTORY}/raw`;
export const VERSIONS_DIRECTORY = `${DATABASE_DIRECTORY}/sanitized`;

const commitQueue = async.queue(_commit, 1);
commitQueue.error((error, { filePath, message, reject }) => {
  reject(new Error(`Could not commit ${filePath} with message "${message}" due to error: ${error}`));
});


export async function record({ serviceId, documentType, content, snapshotId }) {
  const isFiltered = !!snapshotId;
  const { filePath, isNewFile } = await save({ serviceId, documentType, content, isFiltered });
  let message = `Update ${isFiltered ? '' : 'snapshot of '}${serviceId} ${DOCUMENT_TYPES[documentType].name}`;

  if (snapshotId) {
    message += `

This version was recorded after filtering snapshot ${snapshotId}`;
  }

  const sha = await commit(filePath, message);
  return {
    path: filePath,
    id: sha,
    isFirstRecord: isNewFile
  };
}

export async function save({ serviceId, documentType, content, isFiltered }) {
  const directory = `${isFiltered ? VERSIONS_DIRECTORY : SNAPSHOTS_DIRECTORY}/${serviceId}`;

  if (!fsApi.existsSync(directory)) {
    await fs.mkdir(directory, { recursive: true });
  }

  const filePath = `${directory}/${DOCUMENT_TYPES[documentType].fileName}.${isFiltered ? 'md' : 'html'}`;
  const isNewFile = !await isFileExists(filePath);
  return fs.writeFile(filePath, content).then(() => ({
    filePath,
    isNewFile
  }));
}

export async function commit(filePath, message) {
  if (!await git.fileNeedsCommit(filePath)) {
    return;
  }

  return new Promise((resolve, reject) => {
    commitQueue.push({ filePath, message, resolve, reject });
  });
}

async function _commit({ filePath, message, resolve }) {
  await git.add(filePath);
  resolve(await git.commit(filePath, message));
}

async function isFileExists(filePath) {
  let fileExists = true;
  try {
    await fs.access(filePath);
  } catch(error) {
    if (error.code === 'ENOENT') {
      fileExists = false;
    }
  } finally {
    return fileExists;
  }
}
