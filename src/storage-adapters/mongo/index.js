/**
 * This file is the boundary beyond which the usage of MongoDB is abstracted.
 * Object IDs are used as opaque unique IDs.
 */

import { MongoClient, ObjectId } from 'mongodb';

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

    const { _id, content, mimeType, fetchDate } = record;

    return {
      id: _id.toString(),
      content,
      mimeType,
      fetchDate: new Date(fetchDate),
    };
  }

  async _removeAllRecords() {
    return this.collection.deleteMany({});
  }
}
