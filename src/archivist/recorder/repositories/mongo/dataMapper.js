import { ObjectId } from 'mongodb';

import Record from '../../record.js';

export function toPersistence(record) {
  const documentFields = Object.fromEntries(Object.entries(record));

  if (documentFields.snapshotIds) {
    documentFields.snapshotIds = record.snapshotIds.map(snapshotId => new ObjectId(snapshotId));
  }

  documentFields.content = record.content;
  documentFields.created_at = new Date();

  return documentFields;
}

export function toDomain(document) {
  const { _id, serviceId, termsType, pageId, fetchDate, mimeType, isRefilter, isFirstRecord, snapshotIds } = document;

  return new Record({
    id: _id.toString(),
    serviceId,
    termsType,
    pageId,
    mimeType,
    fetchDate: new Date(fetchDate),
    isFirstRecord: Boolean(isFirstRecord),
    isRefilter: Boolean(isRefilter),
    snapshotIds: snapshotIds?.map(snapshotId => snapshotId.toString()) || [],
  });
}
