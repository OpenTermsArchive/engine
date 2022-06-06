import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import chai from 'chai';
import config from 'config';
import { MongoClient } from 'mongodb';

import Record from '../record.js';

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
const FETCH_DATE_EARLIER = new Date('2000-01-01T06:00:00.000Z');
const SNAPSHOT_ID = '61af86dc5ff5caa74ae926ad';
const PDF_CONTENT = fs.readFileSync(path.resolve(__dirname, '../../../test/fixtures/terms.pdf'));
const UPDATED_PDF_CONTENT = fs.readFileSync(path.resolve(__dirname, '../../../test/fixtures/termsModified.pdf'));
const PDF_MIME_TYPE = 'application/pdf';

let collection;

describe('MongoAdapter', () => {
  let subject;

  before(async () => {
    subject = new MongoAdapter(config.get('recorder.snapshots.storage.mongo'));
    await subject.initialize();
    await client.connect();
    const db = client.db(config.get('recorder.snapshots.storage.mongo.database'));

    collection = db.collection(config.get('recorder.snapshots.storage.mongo.collection'));
  });

  describe('#save', () => {
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

        (record = await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: CONTENT,
          mimeType: MIME_TYPE,
          fetchDate: FETCH_DATE,
          snapshotId: SNAPSHOT_ID,
        })));

        numberOfRecordsAfter = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).count();

        (mongoDocument = await collection.findOne({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }));
      });

      after(async () => subject.removeAll());

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
        (record = await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: CONTENT,
          mimeType: MIME_TYPE,
          fetchDate: FETCH_DATE,
          snapshotId: SNAPSHOT_ID,
        })));

        numberOfRecordsBefore = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).count();

        (record = await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: UPDATED_CONTENT,
          mimeType: MIME_TYPE,
          fetchDate: FETCH_DATE,
          snapshotId: SNAPSHOT_ID,
        })));

        numberOfRecordsAfter = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).count();

        ([mongoDocument] = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).limit(1).sort({ created_at: -1 }).toArray());
      });

      after(async () => subject.removeAll());

      it('saves the record', () => {
        expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
      });

      it('returns the record id', () => {
        expect(mongoDocument._id.toString()).to.equal(record.id);
      });

      it('returns a boolean to know if it is the first record', () => {
        expect(record.isFirstRecord).to.be.false;
      });
    });

    context('when the content has not changed', () => {
      before(async () => {
        await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: CONTENT,
          mimeType: MIME_TYPE,
          fetchDate: FETCH_DATE,
        }));

        numberOfRecordsBefore = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).count();

        (record = await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: CONTENT,
          mimeType: MIME_TYPE,
          fetchDate: FETCH_DATE_LATER,
        })));

        numberOfRecordsAfter = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).count();
      });

      after(async () => subject.removeAll());

      it('does not save the record', () => {
        expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore);
      });

      it('returns no id', () => {
        expect(record.id).to.equal(undefined);
      });
    });

    context('when it is a refilter', () => {
      const REFILTERED_CONTENT = `${CONTENT} refiltered`;

      before(async () => {
        await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: CONTENT,
        })); // A refilter cannot be the first record

        numberOfRecordsBefore = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).count();

        (record = await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: REFILTERED_CONTENT,
          mimeType: MIME_TYPE,
          fetchDate: FETCH_DATE,
          snapshotId: SNAPSHOT_ID,
          isRefilter: true,
        })));

        numberOfRecordsAfter = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).count();

        ([mongoDocument] = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).limit(1).sort({ created_at: -1 }).toArray());
      });

      after(async () => subject.removeAll());

      it('saves the record', () => {
        expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
      });

      it('returns the record id', () => {
        expect(mongoDocument._id.toString()).to.equal(record.id);
      });

      it('stores information that it is a refilter of this specific document', () => {
        expect(mongoDocument.isRefilter).to.be.true;
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

        (record = await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: PDF_CONTENT,
          mimeType: PDF_MIME_TYPE,
          fetchDate: FETCH_DATE,
          snapshotId: SNAPSHOT_ID,
        })));

        numberOfRecordsAfter = await collection.find({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }).count();

        (mongoDocument = await collection.findOne({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
        }));
      });

      after(async () => subject.removeAll());

      it('saves the record', () => {
        expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
      });

      it('returns the record id', () => {
        expect(mongoDocument._id.toString()).to.equal(record.id);
      });

      it('stores the proper content', async () => {
        const isSameContent = Buffer.compare(mongoDocument.content.buffer, PDF_CONTENT) == 0;

        expect(isSameContent).to.be.true;
      });

      it('stores the mime type', () => {
        expect(mongoDocument.mimeType).to.equal(PDF_MIME_TYPE);
      });
    });
  });

  describe('#findById', () => {
    let record;
    let id;

    before(async () => {
      ({ id } = await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: DOCUMENT_TYPE,
        content: CONTENT,
        fetchDate: FETCH_DATE,
        snapshotId: SNAPSHOT_ID,
        mimeType: MIME_TYPE,
      })));

      (record = await subject.findById(id));
    });

    after(async () => subject.removeAll());

    it('returns the record id', () => {
      expect(record.id).to.include(id);
    });

    it('returns a boolean to know if it is the first record', () => {
      expect(record.isFirstRecord).to.be.true;
    });

    it('returns the service id', () => {
      expect(record.serviceId).to.equal(SERVICE_PROVIDER_ID);
    });

    it('returns the document type', () => {
      expect(record.documentType).to.equal(DOCUMENT_TYPE);
    });

    it('returns the content', async () => {
      expect(record.content).to.equal(CONTENT);
    });

    it('stores the fetch date', () => {
      expect(new Date(record.fetchDate).getTime()).to.equal(FETCH_DATE.getTime());
    });

    it('stores the mime type', () => {
      expect(record.mimeType).to.equal(MIME_TYPE);
    });

    it('stores the snapshot ID', () => {
      expect(record.snapshotId).to.equal(SNAPSHOT_ID);
    });

    context('when requested record does not exists', () => {
      it('returns an empty object', async () => {
        expect(await subject.findById('inexistantID')).to.deep.equal({});
      });
    });
  });

  describe('#findAll', () => {
    let records;
    const expectedIds = [];

    before(async () => {
      const { id: id1 } = await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: DOCUMENT_TYPE,
        content: CONTENT,
        fetchDate: FETCH_DATE,
        snapshotId: SNAPSHOT_ID,
        mimeType: MIME_TYPE,
      }));

      expectedIds.push(id1);

      const { id: id2 } = await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: DOCUMENT_TYPE,
        content: `${CONTENT} - updated`,
        fetchDate: FETCH_DATE_LATER,
        snapshotId: SNAPSHOT_ID,
        mimeType: MIME_TYPE,
      }));

      expectedIds.push(id2);

      const { id: id3 } = await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: DOCUMENT_TYPE,
        content: `${CONTENT} - updated 2`,
        isRefilter: true,
        fetchDate: FETCH_DATE_EARLIER,
        snapshotId: SNAPSHOT_ID,
        mimeType: MIME_TYPE,
      }));

      expectedIds.push(id3);

      (records = await subject.findAll());
    });

    after(async () => subject.removeAll());

    it('returns all records', () => {
      expect(records.length).to.equal(3);
    });

    it('returns Record objects', () => {
      for (const record of records) {
        expect(record).to.be.an.instanceof(Record);
      }
    });

    it('returns records in ascending order', async () => {
      expect(records.map(record => record.fetchDate)).to.deep.equal([ FETCH_DATE_EARLIER, FETCH_DATE, FETCH_DATE_LATER ]);
    });
  });

  describe('#count', () => {
    let count;

    before(async () => {
      await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: DOCUMENT_TYPE,
        content: CONTENT,
        fetchDate: FETCH_DATE,
        snapshotId: SNAPSHOT_ID,
        mimeType: MIME_TYPE,
      }));
      await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: DOCUMENT_TYPE,
        content: `${CONTENT} - updated`,
        fetchDate: FETCH_DATE_LATER,
        snapshotId: SNAPSHOT_ID,
        mimeType: MIME_TYPE,
      }));
      await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: DOCUMENT_TYPE,
        content: `${CONTENT} - updated 2`,
        isRefilter: true,
        fetchDate: FETCH_DATE_EARLIER,
        snapshotId: SNAPSHOT_ID,
        mimeType: MIME_TYPE,
      }));

      (count = await subject.count());
    });

    after(async () => subject.removeAll());

    it('returns the proper count', async () => {
      expect(count).to.equal(3);
    });
  });

  describe('#findLatestByServiceIdAndDocumentType', () => {
    context('when there are records for the given service', () => {
      let lastSnapshotId;
      let latestRecord;

      context('with HTML document', () => {
        const UPDATED_CONTENT = `${CONTENT} (with additional content to trigger a record)`;

        before(async () => {
          await subject.save(new Record({
            serviceId: SERVICE_PROVIDER_ID,
            documentType: DOCUMENT_TYPE,
            content: CONTENT,
            fetchDate: FETCH_DATE,
          }));

          ({ id: lastSnapshotId } = await subject.save(new Record({
            serviceId: SERVICE_PROVIDER_ID,
            documentType: DOCUMENT_TYPE,
            content: UPDATED_CONTENT,
            mimeType: MIME_TYPE,
            fetchDate: FETCH_DATE_LATER,
          })));

          latestRecord = await subject.findLatestByServiceIdAndDocumentType(
            SERVICE_PROVIDER_ID,
            DOCUMENT_TYPE,
          );
        });

        after(async () => subject.removeAll());

        it('returns the latest record id', () => {
          expect(latestRecord.id).to.include(lastSnapshotId);
        });

        it('returns the latest record content', async () => {
          expect((await latestRecord.content).toString('utf8')).to.equal(UPDATED_CONTENT);
        });

        it('returns the latest record mime type', () => {
          expect(latestRecord.mimeType).to.equal(MIME_TYPE);
        });
      });

      context('with PDF document', () => {
        before(async () => {
          await subject.save(new Record({
            serviceId: SERVICE_PROVIDER_ID,
            documentType: DOCUMENT_TYPE,
            content: PDF_CONTENT,
            mimeType: PDF_MIME_TYPE,
            fetchDate: FETCH_DATE,
          }));

          ({ id: lastSnapshotId } = await subject.save(new Record({
            serviceId: SERVICE_PROVIDER_ID,
            documentType: DOCUMENT_TYPE,
            content: UPDATED_PDF_CONTENT,
            mimeType: PDF_MIME_TYPE,
            fetchDate: FETCH_DATE_LATER,
          })));

          latestRecord = await subject.findLatestByServiceIdAndDocumentType(SERVICE_PROVIDER_ID, DOCUMENT_TYPE);
        });

        after(async () => subject.removeAll());

        it('returns the latest record id', () => {
          expect(latestRecord.id).to.include(lastSnapshotId);
        });

        it('returns the latest record content', async () => {
          const isSameContent = Buffer.compare(latestRecord.content, UPDATED_PDF_CONTENT) == 0;

          expect(isSameContent).to.be.true;
        });

        it('returns the latest record mime type', () => {
          expect(latestRecord.mimeType).to.equal(PDF_MIME_TYPE);
        });
      });
    });

    context('when there are no records for the given service', () => {
      let latestRecord;

      before(async () => {
        latestRecord = await subject.findLatestByServiceIdAndDocumentType(SERVICE_PROVIDER_ID, DOCUMENT_TYPE);
      });

      it('returns an empty object', async () => {
        expect(latestRecord).to.deep.equal({});
      });
    });
  });

  describe('#iterate', () => {
    const expectedIds = [];
    const ids = [];
    const fetchDates = [];

    before(async () => {
      const { id: id1 } = await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: DOCUMENT_TYPE,
        content: CONTENT,
        fetchDate: FETCH_DATE,
        snapshotId: SNAPSHOT_ID,
        mimeType: MIME_TYPE,
      }));

      expectedIds.push(id1);

      const { id: id2 } = await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: DOCUMENT_TYPE,
        content: `${CONTENT} - updated`,
        fetchDate: FETCH_DATE_LATER,
        snapshotId: SNAPSHOT_ID,
        mimeType: MIME_TYPE,
      }));

      expectedIds.push(id2);

      const { id: id3 } = await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: DOCUMENT_TYPE,
        content: `${CONTENT} - updated 2`,
        isRefilter: true,
        fetchDate: FETCH_DATE_EARLIER,
        snapshotId: SNAPSHOT_ID,
        mimeType: MIME_TYPE,
      }));

      expectedIds.push(id3);

      for await (const record of subject.iterate()) {
        ids.push(record.id);
        fetchDates.push(record.fetchDate);
      }
    });

    after(async () => subject.removeAll());

    it('iterates through all records', async () => {
      expect(ids).to.have.members(expectedIds);
    });

    it('iterates in ascending order', async () => {
      expect(fetchDates).to.deep.equal([ FETCH_DATE_EARLIER, FETCH_DATE, FETCH_DATE_LATER ]);
    });
  });
});
