import path from 'path';

import mime from 'mime';

import Record from '../../record.js';

mime.define({ 'text/markdown': ['md'] }, true); // ensure extension for markdown files is `.md` and not `.markdown`

export const COMMIT_MESSAGE_PREFIX = {
  startTracking: 'Start tracking',
  refilter: 'Refilter',
  update: 'Update',
};

export const COMMIT_MESSAGE_PREFIXES_REGEXP = new RegExp(`^(${COMMIT_MESSAGE_PREFIX.startTracking}|${COMMIT_MESSAGE_PREFIX.refilter}|${COMMIT_MESSAGE_PREFIX.update})`);

export function toPersistence(record, prefixMessageToSnapshotId) {
  const { serviceId, documentType, isRefilter, snapshotId, mimeType, isFirstRecord } = record;

  let prefix = isRefilter ? COMMIT_MESSAGE_PREFIX.refilter : COMMIT_MESSAGE_PREFIX.update;

  prefix = isFirstRecord ? COMMIT_MESSAGE_PREFIX.startTracking : prefix;

  let message = `${prefix} ${serviceId} ${documentType}`;

  if (snapshotId) {
    message = `${message}\n\n${prefixMessageToSnapshotId}${snapshotId}`;
  }

  return {
    message,
    content: record.content,
    fileExtension: mime.getExtension(mimeType),
  };
}

export function toDomain(commit) {
  const { hash, date, message, body, diff } = commit;

  const modifiedFilesInCommit = diff.files.map(({ file }) => file);

  if (modifiedFilesInCommit.length > 1) {
    throw new Error(`Only one document should have been recorded in ${hash}, but all these documents were recorded: ${modifiedFilesInCommit.join(', ')}`);
  }

  const [relativeFilePath] = modifiedFilesInCommit;
  const snapshotIdMatch = body.match(/\b[0-9a-f]{5,40}\b/g);

  const record = new Record({
    id: hash,
    serviceId: path.dirname(relativeFilePath),
    documentType: path.basename(relativeFilePath, path.extname(relativeFilePath)),
    mimeType: mime.getType(relativeFilePath),
    fetchDate: new Date(date),
    isFirstRecord: message.startsWith(COMMIT_MESSAGE_PREFIX.startTracking),
    isRefilter: message.startsWith(COMMIT_MESSAGE_PREFIX.refilter),
    snapshotId: snapshotIdMatch && snapshotIdMatch[0],
  });

  return record;
}
