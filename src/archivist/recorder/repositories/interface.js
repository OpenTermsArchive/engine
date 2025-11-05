/**
 * Interface for classes that model a collection of domain objects with querying capabilities
 * @see {@link https://martinfowler.com/eaaCatalog/repository.html|Repository}
 * @interface
 */

import Record from '../record.js';

/* eslint-disable require-await */
class RepositoryInterface {
  /**
   * [Optional] Initialize repository
   * Override this method if the repository needs some asynchronous initialization code (open database connection and create collections, initialize Git…)
   * @returns {Promise<RepositoryInterface>} Promise that will be resolved with the current repository instance
   */
  async initialize() {
    return this;
  }

  /**
   * [Optional] Finalize repository
   * Override this method if the repository needs some asynchronous code to properly close the repository (close database connection, push changes on Git remote…)
   * @returns {Promise<RepositoryInterface>} Promise that will be resolved with the current repository instance
   */
  async finalize() {
    return this;
  }

  /**
   * Persist the given record if it does not already exist in repository
   * @param   {Record}          record - Record to persist
   * @returns {Promise<Record>}        Promise that will be resolved with the given record when it has been persisted
   */
  async save(record) {
    throw new Error(`#save method is not implemented in ${this.constructor.name}`);
  }

  /**
   * Find the most recent record that matches the given service ID and terms type and optionally the document ID
   * In case of snapshots, if the record is related to terms extracted from multiple source documents, the document ID is required to find the source snapshot
   * @param   {string}          serviceId    - Service ID of record to find
   * @param   {string}          termsType    - Terms type of record to find
   * @param   {string}          [documentId] - Document ID of record to find. Used to identify the source in terms extracted from multiple source documents. Not necessary for terms with a single source document
   * @returns {Promise<Record>}              Promise that will be resolved with the found record or an empty object if none match the given criteria
   */
  async findLatest(serviceId, termsType, documentId) {
    throw new Error(`#findLatest method is not implemented in ${this.constructor.name}`);
  }

  /**
   * Find the record that was valid on the given date and that matches the given service ID and terms type and optionally the document ID
   * In case of snapshots, if the record is related to terms extracted from multiple source documents, the document ID is required to find the source snapshot
   * @param   {string}          serviceId    - Service ID of record to find
   * @param   {string}          termsType    - Terms type of record to find
   * @param   {Date}            date         - Datetime on which the record to find was valid
   * @param   {string}          [documentId] - Document ID of record to find. Used to identify the source in terms extracted from multiple source documents. Not necessary for terms with a single source document
   * @returns {Promise<Record>}              Promise that will be resolved with the found record or an empty object if none match the given criteria
   */
  async findByDate(serviceId, termsType, date, documentId) {
    throw new Error(`#findByDate method is not implemented in ${this.constructor.name}`);
  }

  /**
   * Find the record that matches the given record ID
   * @param   {string}          recordId - Record ID of the record to find
   * @returns {Promise<Record>}          Promise that will be resolved with the found record or an empty object if none match the given ID
   */
  async findById(recordId) {
    throw new Error(`#findById method is not implemented in ${this.constructor.name}`);
  }

  /**
   * Find all records
   * For performance reasons, the content of the records will not be loaded by default. Use #loadRecordContent to load the content of individual records
   * @see    RepositoryInterface#loadRecordContent
   * @param   {object}                 [options]        - Pagination options
   * @param   {number}                 [options.limit]  - Maximum number of records to return
   * @param   {number}                 [options.offset] - Number of records to skip
   * @returns {Promise<Array<Record>>}                  Promise that will be resolved with an array of all records
   */
  async findAll(options = {}) {
    throw new Error(`#findAll method is not implemented in ${this.constructor.name}`);
  }

  /**
   * Find all records for a specific service and terms type
   * For performance reasons, the content of the records will not be loaded by default. Use #loadRecordContent to load the content of individual records
   * @see    RepositoryInterface#loadRecordContent
   * @param   {string}                 serviceId        - Service ID of records to find
   * @param   {string}                 termsType        - Terms type of records to find
   * @param   {object}                 [options]        - Pagination options
   * @param   {number}                 [options.limit]  - Maximum number of records to return
   * @param   {number}                 [options.offset] - Number of records to skip
   * @returns {Promise<Array<Record>>}                  Promise that will be resolved with an array of matching records
   */
  async findByServiceAndTermsType(serviceId, termsType, options = {}) {
    throw new Error(`#findByServiceAndTermsType method is not implemented in ${this.constructor.name}`);
  }

  /**
   * Find the first (oldest) record for a specific service and terms type
   * @param   {string}          serviceId - Service ID of record to find
   * @param   {string}          termsType - Terms type of record to find
   * @returns {Promise<Record>}           Promise that will be resolved with the found record or null if none match
   */
  async findFirst(serviceId, termsType) {
    throw new Error(`#findFirst method is not implemented in ${this.constructor.name}`);
  }

  /**
   * Find the previous record (the one before the given version)
   * @param   {string}          versionId - Version ID to find the previous record for
   * @returns {Promise<Record>}           Promise that will be resolved with the found record or null if none match
   */
  async findPrevious(versionId) {
    throw new Error(`#findPrevious method is not implemented in ${this.constructor.name}`);
  }

  /**
   * Find the next record (the one after the given version)
   * @param   {string}          versionId - Version ID to find the next record for
   * @returns {Promise<Record>}           Promise that will be resolved with the found record or null if none match
   */
  async findNext(versionId) {
    throw new Error(`#findNext method is not implemented in ${this.constructor.name}`);
  }

  /**
   * Count the total number of records in the repository
   * For performance reasons, use this method rather than counting the number of entries returned by #findAll if you only need the size of a repository
   * @param   {string}          [serviceId] - Optional service ID to filter records
   * @param   {string}          [termsType] - Optional terms type to filter records (requires serviceId)
   * @returns {Promise<number>}             Promise that will be resolved with the total number of records
   */
  async count(serviceId, termsType) {
    throw new Error(`#count method is not implemented in ${this.constructor.name}`);
  }

  /* eslint-disable jsdoc/require-yields-check */
  /**
   * Iterate over all records in the repository, from oldest to most recent
   * @yields {Record}
   */
  async* iterate() {
    throw new Error(`#iterate method is not implemented in ${this.constructor.name}`);
  }
  /* eslint-enable jsdoc/require-yields-check */

  /**
   * Remove all records
   * @returns {Promise} Promise that will be resolved when all records are removed
   */
  async removeAll() {
    throw new Error(`#removeAll method is not implemented in ${this.constructor.name}`);
  }

  /**
   * Load content of the given record
   * @param   {Record}          record - Record of which to populate content
   * @returns {Promise<Record>}        Promise that will be resolved with the given record when its content has been loaded
   */
  async loadRecordContent(record) {
    throw new Error(`#loadRecordContent method is not implemented in ${this.constructor.name}`);
  }
}

export default RepositoryInterface;
/* eslint-enable require-await */
