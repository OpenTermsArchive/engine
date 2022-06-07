/* eslint-disable no-unused-vars, require-yield, class-methods-use-this, no-empty-function */

/**
 * Interface for classes that represent a repository and act like a collection of domain objects with querying capabilities
 *
 * @interface
 */
export default class RepositoryInterface {
  /**
  * [Optional] Initialize repository
  * Override this function if the repository needs some asynchronous initialization code (open DB connection and create collections, initializate git repository, …)
  *
  * @returns {Promise<Repository>} Promise that will be resolved with the current repository
  */
  async initialize() {}

  /**
  * [Optional] Finalize repository
  * Override this function if the repository needs some asynchronous code to properly close the repository (close DB connection, push changes on git remote, …)
  *
  * @returns {Promise<Repository>} Promise that will be resolved with the current repository
  */
  async finalize() {}

  /**
  * Save the given record if it's not already exist
  *
  * @param {Record} record - Record to save - @see {@link ./record.js}
  * @returns {Promise<Record>} Promise that will be resolved with the given record updated with its recorded Id
  */
  async save(record) {
    throw new Error(`#save function is not yet implemented in ${this.constructor.name}`);
  }

  /**
  * Find the latest record that matches given service Id and document type
  *
  * @param {string} serviceId - Service Id of record to find
  * @param {string} documentType - Document type of record to find
  * @param {boolean} options.deferContentLoading - Enable deferred content loading to improve performance; load content later with #loadRecordContent method
  * @returns {Promise<Record>} Promise that will be resolved with the found record
  */
  async findLatestByServiceIdAndDocumentType(serviceId, documentType, { deferContentLoading } = {}) {
    throw new Error(`#findLatestByServiceIdAndDocumentType function is not yet implemented in ${this.constructor.name}`);
  }

  /**
  * Find the record for the given record Id
  *
  * @param {string} recordId - Record Id of the record to find
  * @param {boolean} options.deferContentLoading - Enable deferred content loading to improve performance; load content later with #loadRecordContent method
  * @returns {Promise<Record>} Promise that will be resolved with the found record
  */
  async findById(recordId, { deferContentLoading } = {}) {
    throw new Error(`#findById function is not yet implemented in ${this.constructor.name}`);
  }

  /**
  * Find all records
  *
  * @param {boolean} options.deferContentLoading - Enable deferred content loading to improve performance; load content later with #loadRecordContent method
  * @returns {Promise<Array<Record>>} Promise that will be resolved with an array of all found records
  */
  async findAll({ deferContentLoading } = {}) {
    throw new Error(`#findAll function is not yet implemented in ${this.constructor.name}`);
  }

  /**
  * Count the number of records
  *
  * @returns {Promise<number>} Promise that will be resolved with the total number of records
  */
  async count() {
    throw new Error(`#count function is not yet implemented in ${this.constructor.name}`);
  }

  /**
  * Iterate through all records
  *
  * @param {boolean} options.deferContentLoading - Enable deferred content loading to improve performance; load content later with #loadRecordContent method
  * @yields {Record} Next record in the iteration
  */
  async* iterate({ deferContentLoading } = {}) {
    throw new Error(`#iterate function is not yet implemented in ${this.constructor.name}`);
  }

  /**
  * Remove all records
  *
  * @returns {Promise} Promise that will be resolved when all records are removed
  */
  async removeAll() {
    throw new Error(`#removeAll function is not yet implemented in ${this.constructor.name}`);
  }

  /**
  * Load content in the given record
  *
  * @param {Record} record - Record to load content - @see {@link ./record.js}
  * @returns {Promise} Promise that will be resolved when the content will be loaded
  */
  async loadRecordContent(record) {
    throw new Error(`#loadRecordContent function is not yet implemented in ${this.constructor.name}`);
  }
}
