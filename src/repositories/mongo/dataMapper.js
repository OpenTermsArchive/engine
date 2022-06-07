import { ObjectId } from 'mongodb';

import Record from '../record.js';

export default class DataMapper {
  constructor({ repository }) {
    this.repository = repository;
  }

  async toPersistence(record) {
    if (record.content === undefined || record.content === null) {
      await this.repository.loadRecordContent(record);
    }

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

  async toDomain(document, { deferContentLoading = false } = {}) {
    if (!document || !document._id) {
      return {};
    }

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

    if (deferContentLoading) {
      return record;
    }

    await this.repository.loadRecordContent(record);

    return record;
  }
}
