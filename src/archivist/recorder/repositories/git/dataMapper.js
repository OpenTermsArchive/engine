import path from 'path';

import mime from 'mime';

import Snapshot from '../../snapshot.js';
import Version from '../../version.js';

mime.define({ 'text/markdown': ['md'] }, true); // ensure extension for markdown files is `.md` and not `.markdown`

export const COMMIT_MESSAGE_PREFIXES = {
  startTracking: 'First record of',
  extractOnly: 'Apply technical or declaration upgrade on',
  update: 'Record new changes of',
  deprecated_startTracking: 'Start tracking',
  deprecated_refilter: 'Refilter',
  deprecated_update: 'Update',
};

export const TERMS_TYPE_AND_DOCUMENT_ID_SEPARATOR = ' #';
export const SNAPSHOT_ID_MARKER = '%SNAPSHOT_ID';
const SINGLE_SOURCE_DOCUMENT_PREFIX = 'This version was recorded after extracting from snapshot';
const MULTIPLE_SOURCE_DOCUMENTS_PREFIX = 'This version was recorded after extracting from and assembling the following snapshots from %NUMBER source documents:';

export const COMMIT_MESSAGE_PREFIXES_REGEXP = new RegExp(`^(${Object.values(COMMIT_MESSAGE_PREFIXES).join('|')})`);

export function toPersistence(recordType, record, snapshotIdentiferTemplate) {
  let message;

  switch (recordType) { // eslint-disable-line default-case
  case Version:
    message = versionMessage(record, snapshotIdentiferTemplate); break;
  case Snapshot:
    message = snapshotMessage(record); break;
  }

  return {
    message,
    content: record.content,
    filePath: generateFilePath(record.serviceId, record.termsType, record.documentId, record.mimeType),
  };
}

function snapshotMessage(record) {
  const { serviceId, termsType, documentId, isFirstRecord } = record;

  const prefix = isFirstRecord ? COMMIT_MESSAGE_PREFIXES.startTracking : COMMIT_MESSAGE_PREFIXES.update;

  const subject = `${prefix} ${serviceId} ${termsType}`;
  const documentIdMessage = `${documentId ? `Document ID ${documentId}\n\n` : ''}`;

  return `${subject}\n\n${documentIdMessage}`;
}

function versionMessage(record, snapshotIdentiferTemplate) {
  const { serviceId, termsType, isExtractOnly, snapshotIds = [], isFirstRecord } = record;

  let prefix = isExtractOnly ? COMMIT_MESSAGE_PREFIXES.extractOnly : COMMIT_MESSAGE_PREFIXES.update;

  prefix = isFirstRecord ? COMMIT_MESSAGE_PREFIXES.startTracking : prefix;

  const subject = `${prefix} ${serviceId} ${termsType}`;
  let snapshotIdsMessage;

  if (snapshotIds.length == 1) {
    snapshotIdsMessage = `${SINGLE_SOURCE_DOCUMENT_PREFIX} ${snapshotIdentiferTemplate.replace(SNAPSHOT_ID_MARKER, snapshotIds[0])}`;
  } else if (snapshotIds.length > 1) {
    snapshotIdsMessage = `${MULTIPLE_SOURCE_DOCUMENTS_PREFIX.replace('%NUMBER', snapshotIds.length)}\n${snapshotIds.map(snapshotId => `- ${snapshotIdentiferTemplate.replace(SNAPSHOT_ID_MARKER, snapshotId)}`).join('\n')}`;
  }

  return `${subject}\n\n${snapshotIdsMessage}`;
}

export function toDomain(recordType, commit) {
  const modifiedFilesInCommit = commit.diff.files.map(({ file }) => file);

  if (modifiedFilesInCommit.length > 1) {
    throw new Error(`Only one file should have been recorded in ${commit.hash}, but all these files were recorded: ${modifiedFilesInCommit.join(', ')}`);
  }

  const [relativeFilePath] = modifiedFilesInCommit;
  const fileExtension = path.extname(relativeFilePath);
  const [ termsType, documentId ] = path.basename(relativeFilePath, fileExtension).split(TERMS_TYPE_AND_DOCUMENT_ID_SEPARATOR);

  const commonAttributes = {
    id: commit.hash,
    serviceId: path.dirname(relativeFilePath),
    termsType,
    fetchDate: new Date(commit.date),
    isFirstRecord: commit.message.startsWith(COMMIT_MESSAGE_PREFIXES.startTracking) || commit.message.startsWith(COMMIT_MESSAGE_PREFIXES.deprecated_startTracking),
  };

  switch (recordType) { // eslint-disable-line default-case
  case Version: {
    const snapshotIdsMatch = commit.body.match(/\b[0-9a-f]{5,40}\b/g);

    return new Version({
      ...commonAttributes,
      isExtractOnly: commit.message.startsWith(COMMIT_MESSAGE_PREFIXES.extractOnly) || commit.message.startsWith(COMMIT_MESSAGE_PREFIXES.deprecated_refilter),
      snapshotIds: snapshotIdsMatch || [],
    });
  }
  case Snapshot:
    return new Snapshot({
      ...commonAttributes,
      mimeType: mime.getType(relativeFilePath),
      documentId,
    });
  }
}

function generateFileName(termsType, documentId, extension) {
  return `${termsType}${documentId ? `${TERMS_TYPE_AND_DOCUMENT_ID_SEPARATOR}${documentId}` : ''}.${extension}`;
}

export function generateFilePath(serviceId, termsType, documentId, mimeType) {
  const extension = mime.getExtension(mimeType) || '*'; // If mime type is undefined, an asterisk is set as an extension. Used to match all files for the given service ID, terms type and document ID when mime type is unknown

  return `${serviceId}/${generateFileName(termsType, documentId, extension)}`; // Do not use `path.join` as even for Windows, the path should be with `/` and not `\`
}
