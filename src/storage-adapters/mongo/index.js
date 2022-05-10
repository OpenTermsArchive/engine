/**
 * This file is the boundary beyond which the usage of MongoDB is abstracted.
 * Object IDs are used as opaque unique IDs.
 */

import { Binary, MongoClient, ObjectId } from 'mongodb';

const PDF_MIME_TYPE = 'application/pdf';

export default class MongoAdapter {
  constructor({ database: databaseName, collection: collectionName, connectionURI }) {
    const client = new MongoClient(connectionURI);

    this.databaseName = databaseName;
    this.collectionName = collectionName;
    this.client = client;
  }

  async initialize() {
    await this.client.connect();
    const db = this.client.db(this.databaseName);

    this.collection = db.collection(this.collectionName);

    return this;
  }

  async finalize() {
    return this.client.close();
  }

  async record({ serviceId, documentType, content: passedContent, mimeType, fetchDate, isRefilter, snapshotId }) {
    let content = passedContent;

    if (mimeType == PDF_MIME_TYPE) {
      content = passedContent.toString('utf-8'); // Serialize PDF
    }

    const previousRecord = await this.getLatestRecord(serviceId, documentType);

    if (previousRecord && previousRecord.content == content) {
      return {};
    }

    const recordProperties = Object.fromEntries(Object.entries({
      serviceId,
      documentType,
      content: passedContent,
      mimeType,
      fetchDate,
      isRefilter,
      snapshotId,
    }).filter(([ , value ]) => value)); // Remove empty values

    const isFirstRecord = !await this.collection.findOne({ serviceId, documentType });

    if (snapshotId) {
      recordProperties.snapshotId = new ObjectId(snapshotId);
    }

    if (isFirstRecord) {
      recordProperties.isFirstRecord = isFirstRecord;
    }

    const insertResult = await this.collection.insertOne({ ...recordProperties, created_at: new Date() });

    return {
      id: insertResult.insertedId.toString(),
      isFirstRecord,
    };
  }

  async getLatestRecord(serviceId, documentType) {
    const [record] = await this.collection.find({ serviceId, documentType }).limit(1).sort({ fetchDate: -1 }).toArray();

    if (!record) {
      return {};
    }

    const { _id, content, mimeType, fetchDate, isRefilter } = record;

    return {
      id: _id.toString(),
      content,
      mimeType,
      fetchDate: new Date(fetchDate),
      isRefilter: Boolean(isRefilter),
    };
  }

  async* iterate() {
    const cursor = this.collection.find().sort({ fetchDate: 1 });

    /* eslint-disable no-await-in-loop */
    while (await cursor.hasNext()) {
      const record = await cursor.next();

      yield this.getRecordFromMongoMetadata(record);
    }
    /* eslint-enable no-await-in-loop */
  }

  async _removeAllRecords() {
    return this.collection.deleteMany();
  }

  getRecordFromMongoMetadata({ _id, serviceId, documentType, fetchDate, mimeType, isRefilter, isFirstRecord, snapshotId }) {
    const { collection } = this;
    const result = {
      id: _id.toString(),
      serviceId,
      documentType,
      mimeType,
      fetchDate: new Date(fetchDate),
      isFirstRecord: Boolean(isFirstRecord),
      isRefilter: Boolean(isRefilter),
      snapshotId: snapshotId && snapshotId.toString(),
      get content() {
        return (async () => {
          const { content } = await collection.findOne({ _id }, { projection: { content: 1 } });

          return content instanceof Binary ? content.buffer : content;
        })();
      },
    };

    return result;
  }
}
