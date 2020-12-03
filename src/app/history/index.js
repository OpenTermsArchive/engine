/**
* This module is the boundary beyond which the persistence method (filesystem and git) is abstracted.
*/

import path from 'path';
import config from 'config';
import { fileURLToPath } from 'url';

import Recorder from './recorder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SNAPSHOTS_PATH = path.resolve(__dirname, '../../..', config.get('history.snapshotsPath'));
export const VERSIONS_PATH = path.resolve(__dirname, '../../..', config.get('history.versionsPath'));

let snapshotRecorder;
let versionRecorder;

export async function init() {
  snapshotRecorder = new Recorder({ path: SNAPSHOTS_PATH, fileExtension: 'html' });
  await snapshotRecorder.init();

  versionRecorder = new Recorder({ path: VERSIONS_PATH, fileExtension: 'md' });
  await versionRecorder.init();
}

export async function recordSnapshot({ serviceId, documentType, content, mimeType, authorDate, extraChangelogContent }) {
  const isFirstRecord = !await snapshotRecorder.isTracked(serviceId, documentType);
  const prefix = isFirstRecord ? 'Start tracking' : 'Update';
  let changelog = `${prefix} ${serviceId} ${documentType}`;
  changelog = extraChangelogContent ? `${changelog}\n\n${extraChangelogContent}` : changelog;
  const recordResult = await snapshotRecorder.record({
    serviceId,
    documentType,
    content,
    changelog,
    mimeType,
    authorDate,
  });

  return {
    ...recordResult,
    isFirstRecord
  };
}

export async function recordVersion({ serviceId, documentType, content, snapshotId }) {
  return _recordVersion({ serviceId, documentType, content, snapshotId });
}

export async function recordRefilter({ serviceId, documentType, content, snapshotId }) {
  return _recordVersion({ serviceId, documentType, content, snapshotId, isRefiltering: true });
}

async function _recordVersion({ serviceId, documentType, content, snapshotId, isRefiltering }) {
  if (!snapshotId) {
    throw new Error(`A snapshot ID is required to ensure data consistency for ${serviceId}'s ${documentType}`);
  }

  let prefix = isRefiltering ? 'Refilter' : 'Update';

  const isFirstRecord = !await versionRecorder.isTracked(serviceId, documentType);
  prefix = isFirstRecord ? 'Start tracking' : prefix;

  const changelog = `${prefix} ${serviceId} ${documentType}

This version was recorded after filtering snapshot ${config.get('history.publish') ? config.get('history.snapshotsBaseUrl') : ''}${snapshotId}`;

  const recordResult = await versionRecorder.record({
    serviceId,
    documentType,
    content,
    changelog
  });

  return {
    ...recordResult,
    isFirstRecord
  };
}

export async function publish() {
  return Promise.all([
    snapshotRecorder.publish(),
    versionRecorder.publish()
  ]);
}

export function getLatestSnapshot(serviceId, documentType) {
  return snapshotRecorder.getLatestRecord(serviceId, documentType);
}
