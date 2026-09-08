import path from 'path';

import mime from 'mime';

import { TITLE_PREFIXES } from '../../record.js';
import Snapshot from '../../snapshot.js';
import Version from '../../version.js';

// Prefixes for commits that represent an actual content change detected at the service source
const CHANGE_PREFIXES = {
  startTracking: TITLE_PREFIXES.firstRecord,
  update: TITLE_PREFIXES.update,
  deprecated_startTracking: 'Start tracking',
  deprecated_update: 'Update',
};

// Prefixes for commits that re-render an existing snapshot (e.g. with updated extraction rules) without any change at the service source
const TECHNICAL_UPGRADE_PREFIXES = {
  technicalUpgrade: TITLE_PREFIXES.technicalUpgrade,
  deprecated_refilter: 'Refilter',
};

export const CHANGE_COMMIT_MESSAGE_PREFIXES = CHANGE_PREFIXES;
export const COMMIT_MESSAGE_PREFIXES = { ...CHANGE_PREFIXES, ...TECHNICAL_UPGRADE_PREFIXES };

export const TERMS_TYPE_AND_DOCUMENT_ID_SEPARATOR = ' #';
export const SNAPSHOT_ID_MARKER = '%SNAPSHOT_ID';
const SINGLE_SOURCE_DOCUMENT_PREFIX = 'This version was recorded after extracting from snapshot';
const MULTIPLE_SOURCE_DOCUMENTS_PREFIX = 'This version was recorded after extracting from and assembling the following snapshots from %NUMBER source documents:';
const CHANGED_SOURCE_DOCUMENTS_PREFIX = 'Changes since the previous version come from %CHANGED of the %NUMBER source documents:';
const ALL_SOURCE_DOCUMENTS_CHANGED_MESSAGE = 'Changes since the previous version come from all %NUMBER source documents.';
const CHANGED_SOURCE_DOCUMENTS_REGEXP = /^Changes since the previous version come from/;
const SOURCE_DOCUMENT_LOCATION_LINE_REGEXP = /^\d+\. (.+)$/; // A numbered line holds a source document location and is followed by an indented line holding its snapshot identifier
const SNAPSHOT_ID_REGEXP = /\b[0-9a-f]{5,40}\b/g;

export const COMMIT_MESSAGE_PREFIXES_REGEXP = new RegExp(`^(${Object.values(COMMIT_MESSAGE_PREFIXES).join('|')})`);

export function isTechnicalUpgrade(message) {
  return message.startsWith(COMMIT_MESSAGE_PREFIXES.technicalUpgrade) || message.startsWith(COMMIT_MESSAGE_PREFIXES.deprecated_refilter);
}

export function toPersistence(record, snapshotIdentiferTemplate) {
  const { serviceId, termsType, documentId, snapshotIds = [], sourceDocumentLocations = [], changedSourceDocumentIndexes = [], mimeType, metadata } = record;

  const subject = record.displayTitle;
  const documentIdMessage = `${documentId ? `Document ID ${documentId}\n\n` : ''}`;
  const snapshotIdentifiers = snapshotIds.map(snapshotId => snapshotIdentiferTemplate.replace(SNAPSHOT_ID_MARKER, snapshotId));
  let changedSourceDocumentsMessage;
  let snapshotIdsMessage;

  if (snapshotIds.length == 1) {
    snapshotIdsMessage = `${SINGLE_SOURCE_DOCUMENT_PREFIX} ${snapshotIdentifiers[0]}`;
  } else if (snapshotIds.length > 1) {
    const sourceDocumentsList = snapshotIdentifiers.map((snapshotIdentifier, index) => formatSourceDocument({ number: index + 1, location: sourceDocumentLocations[index], snapshotIdentifier }));

    snapshotIdsMessage = `${MULTIPLE_SOURCE_DOCUMENTS_PREFIX.replace('%NUMBER', snapshotIds.length)}\n${sourceDocumentsList.join('\n')}`;

    if (changedSourceDocumentIndexes.length == snapshotIds.length) {
      changedSourceDocumentsMessage = ALL_SOURCE_DOCUMENTS_CHANGED_MESSAGE.replace('%NUMBER', snapshotIds.length);
    } else if (changedSourceDocumentIndexes.length) {
      changedSourceDocumentsMessage = `${CHANGED_SOURCE_DOCUMENTS_PREFIX.replace('%CHANGED', changedSourceDocumentIndexes.length).replace('%NUMBER', snapshotIds.length)}\n${changedSourceDocumentIndexes.map(index => sourceDocumentsList[index]).join('\n')}`;
    }
  }

  const filePath = generateFilePath(serviceId, termsType, documentId, mimeType);

  return {
    message: `${subject}\n\n${documentIdMessage || ''}\n\n${changedSourceDocumentsMessage ? `${changedSourceDocumentsMessage}\n\n` : ''}${snapshotIdsMessage || ''}`,
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

    const { snapshotIds, sourceDocumentLocations } = parseSourceDocuments(body);

    attributes.snapshotIds = snapshotIds;

    if (sourceDocumentLocations.length) {
      attributes.sourceDocumentLocations = sourceDocumentLocations;
    }

    return new Version(attributes);
  }

  attributes.mimeType = mimeTypeValue;

  return new Snapshot(attributes);
}

function formatSourceDocument({ number, location, snapshotIdentifier }) {
  if (!location) {
    return `- ${snapshotIdentifier}`; // Keep the plain list when locations are unknown
  }

  const prefix = `${number}. `;

  return `${prefix}${location}\n${' '.repeat(prefix.length)}${snapshotIdentifier}`;
}

function parseSourceDocuments(body) {
  const lines = body
    .split(/\n\n+/)
    .filter(paragraph => !CHANGED_SOURCE_DOCUMENTS_REGEXP.test(paragraph)) // The changed source documents paragraph repeats, out of order, snapshots already listed in full
    .join('\n')
    .split('\n');

  const sourceDocumentLocations = lines.map(line => line.match(SOURCE_DOCUMENT_LOCATION_LINE_REGEXP)?.[1]).filter(Boolean);
  const snapshotIds = lines
    .filter(line => !SOURCE_DOCUMENT_LOCATION_LINE_REGEXP.test(line)) // Locations can contain segments that look like snapshot IDs, such as numeric article IDs
    .join('\n')
    .match(SNAPSHOT_ID_REGEXP);

  return { snapshotIds, sourceDocumentLocations };
}

function generateFileName(termsType, documentId, extension) {
  return `${termsType}${documentId ? `${TERMS_TYPE_AND_DOCUMENT_ID_SEPARATOR}${documentId}` : ''}.${extension}`;
}

export function generateFilePath(serviceId, termsType, documentId, mimeType) {
  if (termsType === undefined) {
    return `${serviceId}/*`; // If only serviceId is provided, return a pattern to match all files for that service
  }

  const extension = mime.getExtension(mimeType) || '*'; // If mime type is undefined, an asterisk is set as an extension. Used to match all files for the given service ID, terms type and document ID when mime type is unknown

  return `${serviceId}/${generateFileName(termsType, documentId, extension)}`; // Do not use `path.join` as even for Windows, the path should be with `/` and not `\`
}
