export default class Record {
  #content;

  #REQUIRED_PARAMS = [ 'serviceId', 'documentType', 'mimeType', 'fetchDate' ];

  constructor(params) {
    this.#validate(params);

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

  #validate(givenParams) {
    for (const param of this.#REQUIRED_PARAMS) {
      if (!Object.prototype.hasOwnProperty.call(givenParams, param)) {
        throw new Error(`"${param}" is required`);
      }
    }
  }
}
