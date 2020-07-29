import path from 'path';
import config from 'config';

import Recorder from './recorder.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export const SNAPSHOTS_PATH = path.resolve(__dirname, '../..', config.get('history.snapshotsPath'));
export const VERSIONS_PATH = path.resolve(__dirname, '../..', config.get('history.versionsPath'));

const snapshotRecorder = new Recorder({ path: SNAPSHOTS_PATH, fileExtension: 'html' });
const versionRecorder = new Recorder({ path: VERSIONS_PATH, fileExtension: 'md' });

export async function recordSnapshot(serviceId, documentType, content) {
  return snapshotRecorder.record({
    serviceId,
    documentType,
    content
  });
}

export async function recordVersion(serviceId, documentType, content, snapshotId) {
  if (!snapshotId) {
    throw new Error(`A snapshot ID is required to ensure data consistency for ${serviceId}'s ${documentType}`);
  }

  return versionRecorder.record({
    serviceId,
    documentType,
    content,
    details: `This version was recorded after filtering snapshot ${config.get('history.publish') ? config.get('history.snapshotsBaseUrl') : ''}${snapshotId}`
  });
}

export async function publish() {
  return Promise.all([
    snapshotRecorder.publish(),
    versionRecorder.publish()
  ]);
}
