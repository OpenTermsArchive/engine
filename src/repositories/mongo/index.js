/**
 * This file is the boundary beyond which the usage of MongoDB is abstracted.
 * Object IDs are used as opaque unique IDs.
 */

import { MongoClient, ObjectId, Binary } from 'mongodb';

import DataMapper from './dataMapper.js';

export default class MongoRepository {
  constructor({ database: databaseName, collection: collectionName, connectionURI }) {
    const client = new MongoClient(connectionURI);

    this.databaseName = databaseName;
    this.collectionName = collectionName;
    this.client = client;
    this.dataMapper = new DataMapper({ repository: this });
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

  async save(record) {
    const { serviceId, documentType } = record;

    if (record.isFirstRecord === undefined || record.isFirstRecord === null) {
      record.isFirstRecord = !await this.collection.findOne({ serviceId, documentType });
    }

    const documentFields = await this.dataMapper.toPersistence(record);

    const { content: previousRecordContent } = await this.findLatestByServiceIdAndDocumentType(serviceId, documentType);

    if (previousRecordContent == documentFields.content) {
      return {};
    }

    const insertResult = await this.collection.insertOne(documentFields);

    record.id = insertResult.insertedId.toString();

    return record;
  }

  async findLatestByServiceIdAndDocumentType(serviceId, documentType, { deferContentLoading } = {}) {
    const [mongoDocument] = await this.collection.find({ serviceId, documentType }).limit(1).sort({ fetchDate: -1 }).toArray(); // `findOne` doesn't support the `sort` method, so even for only one document use `find`

    return this.dataMapper.toDomain(mongoDocument, { deferContentLoading });
  }

  async findById(recordId, { deferContentLoading } = {}) {
    const mongoDocument = await this.collection.findOne({ _id: new ObjectId(recordId) });

    return this.dataMapper.toDomain(mongoDocument, { deferContentLoading });
  }

  async findAll({ deferContentLoading } = {}) {
    return Promise.all((await this.collection.find().project({ content: 0 }).sort({ fetchDate: 1 }).toArray())
      .map(mongoDocument => this.dataMapper.toDomain(mongoDocument, { deferContentLoading })));
  }

  async count() {
    return this.collection.find().count();
  }

  async* iterate({ deferContentLoading } = {}) {
    const cursor = this.collection.find().sort({ fetchDate: 1 });

    /* eslint-disable no-await-in-loop */
    while (await cursor.hasNext()) {
      const mongoDocument = await cursor.next();

      yield this.dataMapper.toDomain(mongoDocument, { deferContentLoading });
    }
    /* eslint-enable no-await-in-loop */
  }

  async removeAll() {
    return this.collection.deleteMany();
  }

  async loadRecordContent(record) {
    const { content } = await this.collection.findOne({ _id: new ObjectId(record.id) }, { projection: { content: 1 } });

    record.content = content instanceof Binary ? content.buffer : content;
  }
}
