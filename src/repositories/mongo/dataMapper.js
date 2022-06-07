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

    const recordProperties = Object.fromEntries(Object.entries({
      serviceId,
      documentType,
      content,
      mimeType,
      fetchDate,
      isRefilter,
      snapshotId,
      isFirstRecord,
    }).filter(([ , value ]) => value)); // Remove empty values

    if (recordProperties.snapshotId) {
      recordProperties.snapshotId = new ObjectId(snapshotId);
    }

    recordProperties.content = record.content;
    recordProperties.created_at = new Date();

    return recordProperties;
  }

  async toDomain(document, { lazyLoadContent = false } = {}) {
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

    if (lazyLoadContent) {
      return record;
    }

    await this.repository.loadRecordContent(record);

    return record;
  }
}
