import path from 'path';

import mime from 'mime';

import Record from '../../record.js';

mime.define({ 'text/markdown': ['md'] }, true); // ensure extension for markdown files is `.md` and not `.markdown`

export const COMMIT_MESSAGE_PREFIX = {
  startTracking: 'Start tracking',
  refilter: 'Refilter',
  update: 'Update',
};

export const TERMS_TYPE_AND_DOCUMENT_ID_SEPARATOR = ' #';
export const SNAPSHOT_ID_MARKER = '%SNAPSHOT_ID';
const SINGLE_SNAPSHOT_PREFIX = 'This version was recorded after filtering snapshot';
const MULTIPLE_SNAPSHOT_PREFIX = 'This version was recorded after filtering and assembling the following snapshots from %NUMBER source documents:';

export const COMMIT_MESSAGE_PREFIXES_REGEXP = new RegExp(`^(${COMMIT_MESSAGE_PREFIX.startTracking}|${COMMIT_MESSAGE_PREFIX.refilter}|${COMMIT_MESSAGE_PREFIX.update})`);

export function toPersistence(record, snapshotIdentiferTemplate) {
  const { serviceId, termsType, documentId, isRefilter, snapshotIds = [], mimeType, isFirstRecord } = record;

  let prefix = isRefilter ? COMMIT_MESSAGE_PREFIX.refilter : COMMIT_MESSAGE_PREFIX.update;

  prefix = isFirstRecord ? COMMIT_MESSAGE_PREFIX.startTracking : prefix;

  const subject = `${prefix} ${serviceId} ${termsType}`;
  const documentIdMessage = `${documentId ? `Document ID ${documentId}\n\n` : ''}`;
  let snapshotIdsMessage;

  if (snapshotIds.length == 1) {
    snapshotIdsMessage = `${SINGLE_SNAPSHOT_PREFIX} ${snapshotIdentiferTemplate.replace(SNAPSHOT_ID_MARKER, snapshotIds[0])}`;
  } else if (snapshotIds.length > 1) {
    snapshotIdsMessage = `${MULTIPLE_SNAPSHOT_PREFIX.replace('%NUMBER', snapshotIds.length)}\n${snapshotIds.map(snapshotId => `- ${snapshotIdentiferTemplate.replace(SNAPSHOT_ID_MARKER, snapshotId)}`).join('\n')}`;
  }

  const filePath = generateFilePath(serviceId, termsType, documentId, mimeType);

  return {
    message: `${subject}\n\n${documentIdMessage || ''}\n\n${snapshotIdsMessage || ''}`,
    content: record.content,
    filePath,
  };
}

export function toDomain(commit) {
  const { hash, date, message, body, diff } = commit;

  const modifiedFilesInCommit = diff.files.map(({ file }) => file);

  if (modifiedFilesInCommit.length > 1) {
    throw new Error(`Only one file should have been recorded in ${hash}, but all these files were recorded: ${modifiedFilesInCommit.join(', ')}`);
  }

  const [relativeFilePath] = modifiedFilesInCommit;
  const snapshotIdsMatch = body.match(/\b[0-9a-f]{5,40}\b/g);

  const [ termsType, documentId ] = path.basename(relativeFilePath, path.extname(relativeFilePath)).split(TERMS_TYPE_AND_DOCUMENT_ID_SEPARATOR);

  return new Record({
    id: hash,
    serviceId: path.dirname(relativeFilePath),
    termsType,
    documentId,
    mimeType: mime.getType(relativeFilePath),
    fetchDate: new Date(date),
    isFirstRecord: message.startsWith(COMMIT_MESSAGE_PREFIX.startTracking),
    isRefilter: message.startsWith(COMMIT_MESSAGE_PREFIX.refilter),
    snapshotIds: snapshotIdsMatch || [],
  });
}

function generateFileName(termsType, documentId, extension) {
  return `${termsType}${documentId ? `${TERMS_TYPE_AND_DOCUMENT_ID_SEPARATOR}${documentId}` : ''}.${extension}`;
}

export function generateFilePath(serviceId, termsType, documentId, mimeType) {
  const extension = mime.getExtension(mimeType) || '*'; // If mime type is undefined, an asterisk is set as an extension. Used to match all files for the given service ID, terms type and document ID when mime type is unknown.

  return `${serviceId}/${generateFileName(termsType, documentId, extension)}`; // Do not use `path.join` as even for Windows, the path should be with `/` and not `\`.
}
