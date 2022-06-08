import { ObjectId } from 'mongodb';

import Record from '../record.js';

export default class DataMapper {
  static toPersistence(record) {
    const { serviceId, documentType, content, mimeType, fetchDate, isRefilter, snapshotId, isFirstRecord } = record;

    const documentFields = Object.fromEntries(Object.entries({
      serviceId,
      documentType,
      content,
      mimeType,
      fetchDate,
      isRefilter,
      snapshotId,
      isFirstRecord,
    }).filter(([ , value ]) => value)); // Remove empty values

    if (documentFields.snapshotId) {
      documentFields.snapshotId = new ObjectId(snapshotId);
    }

    documentFields.content = record.content;
    documentFields.created_at = new Date();

    return documentFields;
  }

  static toDomain(document) {
    const { _id, serviceId, documentType, fetchDate, mimeType, isRefilter, isFirstRecord, snapshotId } = document;

    const record = new Record({
      id: _id.toString(),
      serviceId,
      documentType,
      mimeType,
      fetchDate: new Date(fetchDate),
      isFirstRecord: Boolean(isFirstRecord),
      isRefilter: Boolean(isRefilter),
      snapshotId: snapshotId && snapshotId.toString(),
    });

    return record;
  }
}
