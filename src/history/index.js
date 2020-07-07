import { record } from './recorder.js';
export { pushChanges as publish } from './git.js';

export async function recordSnapshot(serviceId, documentType, content) {
  return record({
    serviceId,
    documentType,
    content
  });
}

export async function recordVersion(serviceId, documentType, content, snapshotId) {
  if (!snapshotId) {
    throw new Error(`A snapshot ID is required to ensure data consistency for ${serviceId}'s ${documentType}`);
  }

  return record({
    serviceId,
    documentType,
    content,
    snapshotId
  });
}
