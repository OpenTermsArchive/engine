import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import chai from 'chai';
import config from 'config';
import { MongoClient } from 'mongodb';

import MongoAdapter from './index.js';

const { expect } = chai;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { connectionURI } = config.get('recorder.snapshots.storage.mongo');
const client = new MongoClient(connectionURI);

const SERVICE_PROVIDER_ID = 'test_service';
const DOCUMENT_TYPE = 'Terms of Service';
const CONTENT = 'ToS fixture data with UTF-8 çhãràčtęrs';
const MIME_TYPE = 'text/html';
const FETCH_DATE = new Date('2000-01-01T12:00:00.000Z');
const FETCH_DATE_LATER = new Date('2000-01-02T12:00:00.000Z');
const SNAPSHOT_ID = '61af86dc5ff5caa74ae926ad';
const PDF_CONTENT = fs.readFileSync(path.resolve(__dirname, '../../../test/fixtures/terms.pdf'), { encoding: 'utf8' });
const UPDATED_PDF_CONTENT = fs.readFileSync(path.resolve(__dirname, '../../../test/fixtures/termsModified.pdf'), { encoding: 'utf8' });
const PDF_MIME_TYPE = 'application/pdf';

let collection;

describe('MongoAdapter', () => {
  let subject;

  before(async () => {
    subject = new MongoAdapter(config.get('recorder.snapshots.storage.mongo'));
    await subject.initialize();
    await client.connect();
    const db = client.db(config.get('recorder.snapshots.storage.mongo').database);

    collection = db.collection(config.get('recorder.snapshots.storage.mongo').collection);
  });

  describe('#record', () => {
    let record;
    let mongoDocument;
    let numberOfRecordsBefore;
    let numberOfRecordsAfter;

    context('when it is the first record', () => {
      before(async () => {
        numberOfRecordsBefore = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).count();

        (record = await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: CONTENT,
          mimeType: MIME_TYPE,
          fetchDate: FETCH_DATE,
          snapshotId: SNAPSHOT_ID,
        }));

        numberOfRecordsAfter = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).count();

        (mongoDocument = await collection.findOne({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }));
      });

      after(() => collection.drop());

      it('saves the record', () => {
        expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
      });

      it('returns the record id', () => {
        expect(mongoDocument._id.toString()).to.equal(record.id);
      });

      it('returns a boolean to know if it is the first record', () => {
        expect(record.isFirstRecord).to.be.true;
      });

      it('stores the service id', () => {
        expect(mongoDocument.serviceId).to.include(SERVICE_PROVIDER_ID);
      });

      it('stores the document type', () => {
        expect(mongoDocument.documentType).to.include(DOCUMENT_TYPE);
      });

      it('stores information that it is the first record for this specific document', () => {
        expect(mongoDocument.isFirstRecord).to.be.true;
      });

      it('stores the proper content', () => {
        expect(mongoDocument.content).to.equal(CONTENT);
      });

      context('when provided', () => {
        it('stores the fetch date', () => {
          expect(new Date(mongoDocument.fetchDate).getTime()).to.equal(FETCH_DATE.getTime());
        });

        it('stores the mime type', () => {
          expect(mongoDocument.mimeType).to.equal(MIME_TYPE);
        });

        it('stores the snapshot ID', () => {
          expect(mongoDocument.snapshotId.toString()).to.include(SNAPSHOT_ID);
        });
      });
    });

    context('when it is not the first record', () => {
      const UPDATED_CONTENT = `${CONTENT} updated`;

      before(async () => {
        (record = await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: CONTENT,
          mimeType: MIME_TYPE,
          fetchDate: FETCH_DATE,
          snapshotId: SNAPSHOT_ID,
        }));

        numberOfRecordsBefore = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).count();

        (record = await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: UPDATED_CONTENT,
          mimeType: MIME_TYPE,
          fetchDate: FETCH_DATE,
          snapshotId: SNAPSHOT_ID,
        }));

        numberOfRecordsAfter = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).count();

        ([mongoDocument] = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).limit(1).sort({ created_at: -1 }).toArray());
      });

      after(() => collection.drop());

      it('saves the record', () => {
        expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
      });

      it('returns the record id', () => {
        expect(mongoDocument._id.toString()).to.equal(record.id);
      });

      it('returns a boolean to know if it is the first record', () => {
        expect(record.isFirstRecord).to.be.false;
      });

      it('stores the service id', () => {
        expect(mongoDocument.serviceId).to.include(SERVICE_PROVIDER_ID);
      });

      it('stores the document type', () => {
        expect(mongoDocument.documentType).to.include(DOCUMENT_TYPE);
      });

      it('stores information that it is the first record for this specific document', () => {
        expect(mongoDocument.isFirstRecord).to.be.undefined;
      });

      it('stores the proper content', () => {
        expect(mongoDocument.content).to.equal(UPDATED_CONTENT);
      });

      context('when provided', () => {
        it('stores the fetch date', () => {
          expect(new Date(mongoDocument.fetchDate).getTime()).to.equal(FETCH_DATE.getTime());
        });

        it('stores the mime type', () => {
          expect(mongoDocument.mimeType).to.equal(MIME_TYPE);
        });

        it('stores the snapshot ID', () => {
          expect(mongoDocument.snapshotId.toString()).to.include(SNAPSHOT_ID);
        });
      });
    });

    context('when the content has not changed', () => {
      before(async () => {
        await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: CONTENT,
          mimeType: MIME_TYPE,
          fetchDate: FETCH_DATE,
        });

        numberOfRecordsBefore = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).count();

        (record = await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: CONTENT,
          mimeType: MIME_TYPE,
          fetchDate: FETCH_DATE_LATER,
        }));

        numberOfRecordsAfter = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).count();
      });

      after(() => collection.drop());

      it('does not save the record', async () => {
        expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore);
      });

      it('returns an id null', async () => {
        expect(record.id).to.equal(null);
      });
    });

    context('when it is a refilter', () => {
      const REFILTERED_CONTENT = `${CONTENT} refiltered`;

      before(async () => {
        await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: CONTENT,
        }); // A refilter cannot be the first record

        numberOfRecordsBefore = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).count();

        (record = await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: REFILTERED_CONTENT,
          mimeType: MIME_TYPE,
          fetchDate: FETCH_DATE,
          snapshotId: SNAPSHOT_ID,
          isRefilter: true,
        }));

        numberOfRecordsAfter = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).count();

        ([mongoDocument] = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).limit(1).sort({ created_at: -1 }).toArray());
      });

      after(() => collection.drop());

      it('saves the record', () => {
        expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
      });

      it('returns the record id', () => {
        expect(mongoDocument._id.toString()).to.equal(record.id);
      });

      it('returns a boolean to know if it is the first record', () => {
        expect(record.isFirstRecord).to.be.false;
      });

      it('stores the service id', () => {
        expect(mongoDocument.serviceId).to.include(SERVICE_PROVIDER_ID);
      });

      it('stores the document type', () => {
        expect(mongoDocument.documentType).to.include(DOCUMENT_TYPE);
      });

      it('stores information that it is a refilter of this specific document', () => {
        expect(mongoDocument.isRefilter).to.be.true;
      });

      it('stores the proper content', () => {
        expect(mongoDocument.content).to.equal(REFILTERED_CONTENT);
      });

      context('when provided', () => {
        it('stores the fetch date', () => {
          expect(new Date(mongoDocument.fetchDate).getTime()).to.equal(FETCH_DATE.getTime());
        });

        it('stores the mime type', () => {
          expect(mongoDocument.mimeType).to.equal(MIME_TYPE);
        });

        it('stores the snapshot ID', () => {
          expect(mongoDocument.snapshotId.toString()).to.include(SNAPSHOT_ID);
        });
      });
    });

    context('with PDF document', () => {
      before(async () => {
        numberOfRecordsBefore = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: PDF_CONTENT,
          mimeType: PDF_MIME_TYPE,
        }).count();

        (record = await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: PDF_CONTENT,
          mimeType: PDF_MIME_TYPE,
          fetchDate: FETCH_DATE,
          snapshotId: SNAPSHOT_ID,
        }));

        numberOfRecordsAfter = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).count();

        (mongoDocument = await collection.findOne({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }));
      });

      after(() => collection.drop());

      it('saves the record', () => {
        expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
      });

      it('returns the record id', () => {
        expect(mongoDocument._id.toString()).to.equal(record.id);
      });

      it('returns a boolean to know if it is the first record', () => {
        expect(record.isFirstRecord).to.be.true;
      });

      it('stores the service id', () => {
        expect(mongoDocument.serviceId).to.include(SERVICE_PROVIDER_ID);
      });

      it('stores the document type', () => {
        expect(mongoDocument.documentType).to.include(DOCUMENT_TYPE);
      });

      it('stores information that it is the first record for this specific document', () => {
        expect(mongoDocument.isFirstRecord).to.be.true;
      });

      it('stores the proper content', () => {
        expect(mongoDocument.content).to.equal(PDF_CONTENT);
      });

      context('when provided', () => {
        it('stores the fetch date', () => {
          expect(new Date(mongoDocument.fetchDate).getTime()).to.equal(FETCH_DATE.getTime());
        });

        it('stores the mime type', () => {
          expect(mongoDocument.mimeType).to.equal(PDF_MIME_TYPE);
        });

        it('stores the snapshot ID', () => {
          expect(mongoDocument.snapshotId.toString()).to.include(SNAPSHOT_ID);
        });
      });
    });
  });

  describe('#getLatestRecord', () => {
    context('when there are records for the given service', () => {
      let lastSnapshotId;
      let latestRecord;

      context('with HTML document', () => {
        const UPDATED_CONTENT = `${CONTENT} (with additional content to trigger a record)`;

        before(async () => {
          await subject.record({
            serviceId: SERVICE_PROVIDER_ID,
            documentType: DOCUMENT_TYPE,
            content: CONTENT,
            fetchDate: FETCH_DATE,
          });

          ({ id: lastSnapshotId } = await subject.record({
            serviceId: SERVICE_PROVIDER_ID,
            documentType: DOCUMENT_TYPE,
            content: UPDATED_CONTENT,
            mimeType: MIME_TYPE,
            fetchDate: FETCH_DATE_LATER,
          }));

          latestRecord = await subject.getLatestRecord(
            SERVICE_PROVIDER_ID,
            DOCUMENT_TYPE,
          );
        });

        after(() => collection.drop());

        it('returns the latest record id', async () => {
          expect(latestRecord.id).to.include(lastSnapshotId);
        });

        it('returns the latest record content', async () => {
          expect(latestRecord.content.toString('utf8')).to.equal(UPDATED_CONTENT);
        });

        it('returns the latest record mime type', async () => {
          expect(latestRecord.mimeType).to.equal(MIME_TYPE);
        });
      });

      context('with PDF document', () => {
        before(async () => {
          await subject.record({
            serviceId: SERVICE_PROVIDER_ID,
            documentType: DOCUMENT_TYPE,
            content: PDF_CONTENT,
            mimeType: PDF_MIME_TYPE,
            fetchDate: FETCH_DATE,
          });

          ({ id: lastSnapshotId } = await subject.record({
            serviceId: SERVICE_PROVIDER_ID,
            documentType: DOCUMENT_TYPE,
            content: UPDATED_PDF_CONTENT,
            mimeType: PDF_MIME_TYPE,
            fetchDate: FETCH_DATE_LATER,
          }));

          latestRecord = await subject.getLatestRecord(SERVICE_PROVIDER_ID, DOCUMENT_TYPE);
        });

        after(() => collection.drop());

        it('returns the latest record id', async () => {
          expect(latestRecord.id).to.include(lastSnapshotId);
        });

        it('returns the latest record content', async () => {
          expect(latestRecord.content).to.equal(UPDATED_PDF_CONTENT);
        });

        it('returns the latest record mime type', async () => {
          expect(latestRecord.mimeType).to.equal(PDF_MIME_TYPE);
        });
      });
    });

    context('when there are no records for the given service', () => {
      let latestRecord;

      before(async () => {
        latestRecord = await subject.getLatestRecord(SERVICE_PROVIDER_ID, DOCUMENT_TYPE);
      });

      it('returns no id', async () => {
        expect(latestRecord.id).to.be.null;
      });

      it('returns no content', async () => {
        expect(latestRecord.content).to.be.null;
      });

      it('returns no mime type', async () => {
        expect(latestRecord.mimeType).to.be.null;
      });
    });
  });
});
