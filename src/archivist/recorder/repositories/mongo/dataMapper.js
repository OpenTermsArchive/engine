import { ObjectId } from 'mongodb';

import Record from '../../record.js';

export function toPersistence(record) {
  const recordFields = Object.fromEntries(Object.entries(record));

  if (recordFields.snapshotIds) {
    recordFields.snapshotIds = record.snapshotIds.map(snapshotId => new ObjectId(snapshotId));
  }

  recordFields.content = record.content;
  recordFields.created_at = new Date();

  return recordFields;
}

export function toDomain(mongoDocument) {
  const { _id, serviceId, termsType, documentId, fetchDate, mimeType, isExtractOnly, isRefilter, isFirstRecord, snapshotIds } = mongoDocument;

  return new Record({
    id: _id.toString(),
    serviceId,
    termsType,
    documentId,
    mimeType,
    fetchDate: new Date(fetchDate),
    isFirstRecord: Boolean(isFirstRecord),
    isExtractOnly: Boolean(isExtractOnly) || Boolean(isRefilter),
    snapshotIds: snapshotIds?.map(snapshotId => snapshotId.toString()) || [],
  });
}
