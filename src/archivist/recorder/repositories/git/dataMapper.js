import path from 'path';

import mime from 'mime';

import { TITLE_PREFIXES } from '../../record.js';
import Snapshot from '../../snapshot.js';
import Version from '../../version.js';

export const COMMIT_MESSAGE_PREFIXES = {
  startTracking: TITLE_PREFIXES.firstRecord,
  technicalUpgrade: TITLE_PREFIXES.technicalUpgrade,
  update: TITLE_PREFIXES.update,
  deprecated_startTracking: 'Start tracking',
  deprecated_refilter: 'Refilter',
  deprecated_update: 'Update',
};

// Subset of COMMIT_MESSAGE_PREFIXES that exclude technical upgrades (re-renders of existing snapshots with updated extraction rules) and only represent content changes detected at the service source
export const REAL_CHANGE_COMMIT_MESSAGE_PREFIXES = {
  startTracking: COMMIT_MESSAGE_PREFIXES.startTracking,
  update: COMMIT_MESSAGE_PREFIXES.update,
  deprecated_startTracking: COMMIT_MESSAGE_PREFIXES.deprecated_startTracking,
  deprecated_update: COMMIT_MESSAGE_PREFIXES.deprecated_update,
};

export const TERMS_TYPE_AND_DOCUMENT_ID_SEPARATOR = ' #';
export const SNAPSHOT_ID_MARKER = '%SNAPSHOT_ID';
const SINGLE_SOURCE_DOCUMENT_PREFIX = 'This version was recorded after extracting from snapshot';
const MULTIPLE_SOURCE_DOCUMENTS_PREFIX = 'This version was recorded after extracting from and assembling the following snapshots from %NUMBER source documents:';

export const COMMIT_MESSAGE_PREFIXES_REGEXP = new RegExp(`^(${Object.values(COMMIT_MESSAGE_PREFIXES).join('|')})`);

export function toPersistence(record, snapshotIdentiferTemplate) {
  const { serviceId, termsType, documentId, snapshotIds = [], mimeType, metadata } = record;

  const subject = record.displayTitle;
  const documentIdMessage = `${documentId ? `Document ID ${documentId}\n\n` : ''}`;
  let snapshotIdsMessage;

  if (snapshotIds.length == 1) {
    snapshotIdsMessage = `${SINGLE_SOURCE_DOCUMENT_PREFIX} ${snapshotIdentiferTemplate.replace(SNAPSHOT_ID_MARKER, snapshotIds[0])}`;
  } else if (snapshotIds.length > 1) {
    snapshotIdsMessage = `${MULTIPLE_SOURCE_DOCUMENTS_PREFIX.replace('%NUMBER', snapshotIds.length)}\n${snapshotIds.map(snapshotId => `- ${snapshotIdentiferTemplate.replace(SNAPSHOT_ID_MARKER, snapshotId)}`).join('\n')}`;
  }

  const filePath = generateFilePath(serviceId, termsType, documentId, mimeType);

  return {
    message: `${subject}\n\n${documentIdMessage || ''}\n\n${snapshotIdsMessage || ''}`,
    content: record.content,
    filePath,
    metadata,
  };
}

export function toDomain(commit) {
  const { hash, date, message, body, diff, trailers = {} } = commit;

  const modifiedFilesInCommit = diff.files.map(({ file }) => file);

  if (modifiedFilesInCommit.length > 1) {
    throw new Error(`Only one file should have been recorded in ${hash}, but all these files were recorded: ${modifiedFilesInCommit.join(', ')}`);
  }

  const [relativeFilePath] = modifiedFilesInCommit;
  const snapshotIdsMatch = body.match(/\b[0-9a-f]{5,40}\b/g);

  const [ termsType, documentId ] = path.basename(relativeFilePath, path.extname(relativeFilePath)).split(TERMS_TYPE_AND_DOCUMENT_ID_SEPARATOR);

  const attributes = {
    id: hash,
    serviceId: path.dirname(relativeFilePath),
    termsType,
    documentId,
    fetchDate: new Date(date),
    isFirstRecord: message.startsWith(COMMIT_MESSAGE_PREFIXES.startTracking) || message.startsWith(COMMIT_MESSAGE_PREFIXES.deprecated_startTracking),
    metadata: { ...trailers },
  };

  const mimeTypeValue = mime.getType(relativeFilePath);

  if (mimeTypeValue == mime.getType('markdown')) {
    attributes.isTechnicalUpgrade = message.startsWith(COMMIT_MESSAGE_PREFIXES.technicalUpgrade) || message.startsWith(COMMIT_MESSAGE_PREFIXES.deprecated_refilter);
    attributes.snapshotIds = snapshotIdsMatch;

    return new Version(attributes);
  }

  attributes.mimeType = mimeTypeValue;

  return new Snapshot(attributes);
}

function generateFileName(termsType, documentId, extension) {
  return `${termsType}${documentId ? `${TERMS_TYPE_AND_DOCUMENT_ID_SEPARATOR}${documentId}` : ''}.${extension}`;
}

export function generateFilePath(serviceId, termsType, documentId, mimeType) {
  // If only serviceId is provided, return a pattern to match all files for that service
  if (termsType === undefined) {
    return `${serviceId}/*`;
  }

  const extension = mime.getExtension(mimeType) || '*'; // If mime type is undefined, an asterisk is set as an extension. Used to match all files for the given service ID, terms type and document ID when mime type is unknown

  return `${serviceId}/${generateFileName(termsType, documentId, extension)}`; // Do not use `path.join` as even for Windows, the path should be with `/` and not `\`
}
