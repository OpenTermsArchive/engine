import { ObjectId } from 'mongodb';

import Record from '../../record.js';

export function toPersistence(record) {
  const documentFields = Object.fromEntries(Object.entries(record));

  if (documentFields.snapshotId) {
    documentFields.snapshotId = new ObjectId(record.snapshotId);
  }

  documentFields.content = record.content;
  documentFields.created_at = new Date();

  return documentFields;
}

export function toDomain(document) {
  const { _id, serviceId, documentType, fetchDate, mimeType, isRefilter, isFirstRecord, snapshotId } = document;

  return new Record({
    id: _id.toString(),
    serviceId,
    documentType,
    mimeType,
    fetchDate: new Date(fetchDate),
    isFirstRecord: Boolean(isFirstRecord),
    isRefilter: Boolean(isRefilter),
    snapshotId: snapshotId && snapshotId.toString(),
  });
}
