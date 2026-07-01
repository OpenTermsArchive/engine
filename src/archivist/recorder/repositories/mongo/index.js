/**
 * This module is the boundary beyond which the usage of MongoDB is abstracted.
 * Object IDs are used as opaque unique IDs.
 */

import { MongoClient, ObjectId, Binary } from 'mongodb';

import RepositoryInterface from '../interface.js';

import * as DataMapper from './dataMapper.js';

export default class MongoRepository extends RepositoryInterface {
  constructor({ database: databaseName, collection: collectionName, connectionURI }) {
    super();

    this.client = new MongoClient(connectionURI);
    this.databaseName = databaseName;
    this.collectionName = collectionName;
  }

  async initialize() {
    await this.client.connect();
    const db = this.client.db(this.databaseName);

    this.collection = db.collection(this.collectionName);

    this.collection.createIndex({ serviceId: 1, termsType: 1, fetchDate: -1 });

    return this;
  }

  finalize() {
    return this.client.close();
  }

  async save(record) {
    const { serviceId, termsType, documentId } = record;

    if (record.isFirstRecord === undefined || record.isFirstRecord === null) {
      record.isFirstRecord = !await this.collection.findOne({ serviceId, termsType, documentId });
    }

    const documentFields = await this.#toPersistence(record);
    const previousRecord = await this.findLatest(serviceId, termsType, documentId);

    if (previousRecord?.content == documentFields.content) {
      return Object(null);
    }

    const insertResult = await this.collection.insertOne(documentFields);

    record.id = insertResult.insertedId.toString();

    return record;
  }

  async findLatest(serviceId, termsType, documentId) {
    const query = { serviceId, termsType };

    if (documentId !== undefined) {
      query.documentId = documentId;
    }

    const [mongoDocument] = await this.collection.find(query).limit(1).sort({ fetchDate: -1 }).toArray(); // `findOne` doesn't support the `sort` method, so even for only one mongo document use `find`

    return this.#toDomain(mongoDocument);
  }

  async findByDate(serviceId, termsType, date, documentId) {
    const query = { serviceId, termsType, fetchDate: { $lte: new Date(date) } };

    if (documentId !== undefined) {
      query.documentId = documentId;
    }

    const [mongoDocument] = await this.collection.find(query).limit(1).sort({ fetchDate: -1 }).toArray(); // `findOne` doesn't support the `sort` method, so even for only one mongo document use `find`

    return this.#toDomain(mongoDocument);
  }

  async findById(recordId) {
    if (!ObjectId.isValid(recordId)) {
      return null;
    }

    const mongoDocument = await this.collection.findOne({ _id: ObjectId.createFromHexString(recordId) });

    return this.#toDomain(mongoDocument);
  }

  async findMetadataById(recordId) {
    if (!ObjectId.isValid(recordId)) {
      return null;
    }

    const document = await this.collection.findOne(
      { _id: ObjectId.createFromHexString(recordId) },
      { projection: { content: 0 } },
    );

    return document ? this.#toDomain(document, { deferContentLoading: true }) : null;
  }

  async findAll({ limit, offset, includeTechnicalUpgrades = true } = {}) {
    const filter = includeTechnicalUpgrades ? {} : { isTechnicalUpgrade: { $ne: true } };
    let query = this.collection.find(filter).project({ content: 0 }).sort({ fetchDate: -1 });

    if (offset !== undefined) {
      query = query.skip(offset);
    }

    if (limit !== undefined) {
      query = query.limit(limit);
    }

    return Promise.all((await query.toArray())
      .map(mongoDocument => this.#toDomain(mongoDocument, { deferContentLoading: true })));
  }

  async findByServiceAndTermsType(serviceId, termsType, { limit, offset, includeTechnicalUpgrades = true } = {}) {
    const filter = { serviceId, termsType };

    if (!includeTechnicalUpgrades) {
      filter.isTechnicalUpgrade = { $ne: true };
    }

    let query = this.collection.find(filter).project({ content: 0 }).sort({ fetchDate: -1 });

    if (offset !== undefined) {
      query = query.skip(offset);
    }

    if (limit !== undefined) {
      query = query.limit(limit);
    }

    return Promise.all((await query.toArray())
      .map(mongoDocument => this.#toDomain(mongoDocument, { deferContentLoading: true })));
  }

  async findByService(serviceId, { limit, offset, includeTechnicalUpgrades = true } = {}) {
    const filter = { serviceId };

    if (!includeTechnicalUpgrades) {
      filter.isTechnicalUpgrade = { $ne: true };
    }

    let query = this.collection.find(filter).project({ content: 0 }).sort({ fetchDate: -1 });

    if (offset !== undefined) {
      query = query.skip(offset);
    }

    if (limit !== undefined) {
      query = query.limit(limit);
    }

    return Promise.all((await query.toArray())
      .map(mongoDocument => this.#toDomain(mongoDocument, { deferContentLoading: true })));
  }

  async getNavigationIds(serviceId, termsType, versionId, { includeTechnicalUpgrades = true } = {}) {
    const empty = { first: null, prev: null, next: null, last: null };

    if (!ObjectId.isValid(versionId)) {
      return empty;
    }

    const _id = ObjectId.createFromHexString(versionId);
    const filter = { serviceId, termsType };

    if (!includeTechnicalUpgrades) {
      filter.isTechnicalUpgrade = { $ne: true };
    }

    const current = await this.collection.findOne({ ...filter, _id }, { projection: { fetchDate: 1 } });

    if (!current) {
      return empty;
    }

    const { fetchDate } = current;
    const idOnly = { projection: { _id: 1 } };

    // Deterministic total order (fetchDate, then _id) ascending; prev is the greatest record strictly before the current one, next the least strictly after.
    // Using _id as a tiebreaker makes prev and next well-defined even for versions sharing the same fetch date, so navigation always round-trips.
    const [ oldest, newest, previous, next ] = await Promise.all([
      this.collection.find(filter, idOnly).sort({ fetchDate: 1, _id: 1 }).limit(1).next(),
      this.collection.find(filter, idOnly).sort({ fetchDate: -1, _id: -1 }).limit(1).next(),
      this.collection.find({ ...filter, $or: [{ fetchDate: { $lt: fetchDate } }, { fetchDate, _id: { $lt: _id } }] }, idOnly).sort({ fetchDate: -1, _id: -1 }).limit(1).next(),
      this.collection.find({ ...filter, $or: [{ fetchDate: { $gt: fetchDate } }, { fetchDate, _id: { $gt: _id } }] }, idOnly).sort({ fetchDate: 1, _id: 1 }).limit(1).next(),
    ]);

    return {
      first: oldest?._id?.toString() || null,
      last: newest?._id?.toString() || null,
      prev: previous?._id?.toString() || null,
      next: next?._id?.toString() || null,
    };
  }

  count(serviceId, termsType) {
    const filter = {};

    if (serviceId) {
      filter.serviceId = serviceId;
    }

    if (termsType) {
      filter.termsType = termsType;
    }

    return this.collection.countDocuments(filter);
  }

  async* iterate() {
    const cursor = this.collection.find().sort({ fetchDate: 1 });

    while (await cursor.hasNext()) {
      const mongoDocument = await cursor.next();

      yield this.#toDomain(mongoDocument);
    }
  }

  removeAll() {
    return this.collection.deleteMany();
  }

  async loadRecordContent(record) {
    const { content } = await this.collection.findOne({ _id: ObjectId.createFromHexString(record.id) }, { projection: { content: 1 } });

    record.content = content instanceof Binary ? content.buffer : content;
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  getDiffStats(recordId) {
    return { additions: null, deletions: null }; // Diff stats are not available for MongoDB storage
  }

  async #toDomain(mongoDocument, { deferContentLoading } = {}) {
    if (!mongoDocument) {
      return null;
    }

    const record = DataMapper.toDomain(mongoDocument);

    if (deferContentLoading) {
      return record;
    }

    await this.loadRecordContent(record);

    return record;
  }

  async #toPersistence(record) {
    if (record.content === undefined || record.content === null) {
      await this.loadRecordContent(record);
    }

    return DataMapper.toPersistence(record);
  }
}
