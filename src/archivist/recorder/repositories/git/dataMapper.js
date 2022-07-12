import path from 'path';

import mime from 'mime';

import Record from '../../record.js';

mime.define({ 'text/markdown': ['md'] }, true); // ensure extension for markdown files is `.md` and not `.markdown`

export const COMMIT_MESSAGE_PREFIX = {
  startTracking: 'Start tracking',
  refilter: 'Refilter',
  update: 'Update',
};

export const DOCUMENT_TYPE_AND_PAGE_ID_SEPARATOR = ' - ';

export const COMMIT_MESSAGE_PREFIXES_REGEXP = new RegExp(`^(${COMMIT_MESSAGE_PREFIX.startTracking}|${COMMIT_MESSAGE_PREFIX.refilter}|${COMMIT_MESSAGE_PREFIX.update})`);

export function toPersistence(record, prefixMessageToSnapshotId) {
  const { serviceId, documentType, pageId, isRefilter, snapshotIds, mimeType, isFirstRecord } = record;

  let prefix = isRefilter ? COMMIT_MESSAGE_PREFIX.refilter : COMMIT_MESSAGE_PREFIX.update;

  prefix = isFirstRecord ? COMMIT_MESSAGE_PREFIX.startTracking : prefix;

  let message = `${prefix} ${serviceId} ${documentType}${pageId ? ` - ${pageId}` : ''}\n`;

  if (snapshotIds?.length) {
    for (const snapshotId of snapshotIds) {
      message = `${message}\n${prefixMessageToSnapshotId}${snapshotId}`;
    }
  }

  const filePath = generateFilePath(serviceId, documentType, pageId, mimeType);

  return {
    message,
    content: record.content,
    filePath,
  };
}

export function toDomain(commit) {
  const { hash, date, message, body, diff } = commit;

  const modifiedFilesInCommit = diff.files.map(({ file }) => file);

  if (modifiedFilesInCommit.length > 1) {
    throw new Error(`Only one document should have been recorded in ${hash}, but all these documents were recorded: ${modifiedFilesInCommit.join(', ')}`);
  }

  const [relativeFilePath] = modifiedFilesInCommit;
  const snapshotIdsMatch = body.match(/\b[0-9a-f]{5,40}\b/g);

  const [ documentType, pageId ] = path.basename(relativeFilePath, path.extname(relativeFilePath)).split(DOCUMENT_TYPE_AND_PAGE_ID_SEPARATOR);

  return new Record({
    id: hash,
    serviceId: path.dirname(relativeFilePath),
    documentType,
    pageId,
    mimeType: mime.getType(relativeFilePath),
    fetchDate: new Date(date),
    isFirstRecord: message.startsWith(COMMIT_MESSAGE_PREFIX.startTracking),
    isRefilter: message.startsWith(COMMIT_MESSAGE_PREFIX.refilter),
    snapshotIds: snapshotIdsMatch,
  });
}

export function generateFileName(documentType, pageId, mimeType) {
  const extension = mime.getExtension(mimeType) || '*';

  return `${documentType}${pageId ? `${DOCUMENT_TYPE_AND_PAGE_ID_SEPARATOR}${pageId}` : ''}.${extension}`;
}

export function generateFilePath(serviceId, documentType, pageId, mimeType) {
  return `${serviceId}/${generateFileName(documentType, pageId, mimeType)}`;
}
