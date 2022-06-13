export default class Record {
  #content;

  static #REQUIRED_PARAMS = [ 'serviceId', 'documentType', 'mimeType', 'fetchDate' ];

  constructor(params) {
    Record.#validate(params);

    const { id, serviceId, documentType, mimeType, fetchDate, isFirstRecord, isRefilter, snapshotId, content } = params;

    this.serviceId = serviceId;
    this.documentType = documentType;
    this.mimeType = mimeType;
    this.fetchDate = fetchDate;
    this.isFirstRecord = isFirstRecord;
    this.isRefilter = isRefilter;
    this.snapshotId = snapshotId;

    if (id) {
      this.id = id;
    }

    if (content) {
      this.#content = content;
    }
  }

  get content() {
    if (this.#content === undefined) {
      throw new Error('Record content not defined, set the content or use Repository#loadRecordContent');
    }

    return this.#content;
  }

  set content(content) {
    this.#content = content;
  }

  static #validate(givenParams) {
    for (const param of Record.#REQUIRED_PARAMS) {
      if (!Object.prototype.hasOwnProperty.call(givenParams, param) || givenParams[param] == null) {
        throw new Error(`"${param}" is required`);
      }
    }
  }
}
