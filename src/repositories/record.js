export default class Record {
  constructor({ id, serviceId, documentType, mimeType, fetchDate, isFirstRecord, isRefilter, snapshotId, content }) {
    this.id = id;
    this.serviceId = serviceId;
    this.documentType = documentType;
    this.mimeType = mimeType;
    this.fetchDate = fetchDate;
    this.isFirstRecord = isFirstRecord;
    this.isRefilter = isRefilter;
    this.snapshotId = snapshotId;
    if (content) {
      this.content = content;
    }
  }
}
