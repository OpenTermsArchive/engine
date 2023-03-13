import { ObjectId } from 'mongodb';

import Snapshot from '../../snapshot.js';
import Version from '../../version.js';

export function toPersistence(recordType, record) {
  const commonFields = {
    serviceId: record.serviceId,
    termsType: record.termsType,
    fetchDate: record.fetchDate,
    isFirstRecord: record.isFirstRecord,
    content: record.content,
    created_at: new Date(),
  };

  switch (recordType) { // eslint-disable-line default-case
  case Version:
    return {
      ...commonFields,
      isExtractOnly: record.isExtractOnly,
      snapshotIds: record.snapshotIds?.map(snapshotId => new ObjectId(snapshotId)),
    };
  case Snapshot:
    return {
      ...commonFields,
      documentId: record.documentId,
      mimeType: record.mimeType,
    };
  }
}

export function toDomain(recordType, mongoDocument) {
  const { _id, serviceId, termsType, documentId, fetchDate, mimeType, isExtractOnly, isRefilter, isFirstRecord, snapshotIds } = mongoDocument;

  const commonAttributes = {
    id: _id.toString(),
    serviceId,
    termsType,
    fetchDate: new Date(fetchDate),
    isFirstRecord: Boolean(isFirstRecord),
  };

  switch (recordType) { // eslint-disable-line default-case
  case Version:
    return new Version({
      ...commonAttributes,
      isExtractOnly: Boolean(isExtractOnly) || Boolean(isRefilter),
      snapshotIds: snapshotIds?.map(snapshotId => snapshotId.toString()) || [],
    });
  case Snapshot:
    return new Snapshot({
      ...commonAttributes,
      documentId,
      mimeType,
    });
  }
}
