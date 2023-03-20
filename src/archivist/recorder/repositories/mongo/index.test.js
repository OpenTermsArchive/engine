import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import chai from 'chai';
import config from 'config';
import mime from 'mime';
import { MongoClient } from 'mongodb';

import Snapshot from '../../snapshot.js';
import Version from '../../version.js';

import MongoRepository from './index.js';

const { expect } = chai;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { connectionURI } = config.get('recorder.snapshots.storage.mongo');
const client = new MongoClient(connectionURI);

const SERVICE_PROVIDER_ID = 'test_service';
const TERMS_TYPE = 'Terms of Service';
const DOCUMENT_ID = 'community-standards-hate-speech';
const CONTENT = 'ToS fixture data with UTF-8 çhãràčtęrs';

const FETCH_DATE = new Date('2000-01-01T12:00:00.000Z');
const FETCH_DATE_LATER = new Date('2000-01-02T12:00:00.000Z');
const FETCH_DATE_EARLIER = new Date('2000-01-01T06:00:00.000Z');

const SNAPSHOT_ID = '61af86dc5ff5caa74ae926ad';
const HTML_MIME_TYPE = mime.getType('html');

const PDF_CONTENT = fs.readFileSync(path.resolve(__dirname, '../../../../../test/fixtures/terms.pdf'));
const UPDATED_PDF_CONTENT = fs.readFileSync(path.resolve(__dirname, '../../../../../test/fixtures/termsModified.pdf'));
const PDF_MIME_TYPE = mime.getType('pdf');

let collection;

describe('MongoRepository', () => {
  let subject;

  context('Version', () => {
    before(async () => {
      subject = new MongoRepository(config.get('recorder.versions.storage.mongo'));
      await subject.initialize();
      await client.connect();
      const db = client.db(config.get('recorder.versions.storage.mongo.database'));

      collection = db.collection(config.get('recorder.versions.storage.mongo.collection'));
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
            termsType: TERMS_TYPE,
          }).count();

          (record = await subject.save(new Version({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            fetchDate: FETCH_DATE,
            snapshotIds: [SNAPSHOT_ID],
          })));

          numberOfRecordsAfter = await collection.find({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }).count();

          (mongoDocument = await collection.findOne({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }));
        });

        after(async () => subject.removeAll());

        it('saves the record', () => {
          expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
        });

        it('returns the record id', () => {
          expect(mongoDocument._id.toString()).to.equal(record.id);
        });

        it('states that it is the first record', () => {
          expect(record.isFirstRecord).to.be.true;
        });

        it('stores the service ID', () => {
          expect(mongoDocument.serviceId).to.include(SERVICE_PROVIDER_ID);
        });

        it('stores the terms type', () => {
          expect(mongoDocument.termsType).to.include(TERMS_TYPE);
        });

        it('stores information that it is the first record for these specific terms', () => {
          expect(mongoDocument.isFirstRecord).to.be.true;
        });

        it('stores the proper content', () => {
          expect(mongoDocument.content).to.equal(CONTENT);
        });

        it('stores the fetch date', () => {
          expect(new Date(mongoDocument.fetchDate).getTime()).to.equal(FETCH_DATE.getTime());
        });

        it('stores the snapshot ID', () => {
          expect(mongoDocument.snapshotIds.map(snapshotId => snapshotId.toString())).to.deep.equal([SNAPSHOT_ID]);
        });
      });

      context('when it is not the first record', () => {
        const UPDATED_CONTENT = `${CONTENT} updated`;

        before(async () => {
          (record = await subject.save(new Version({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            fetchDate: FETCH_DATE,
            snapshotIds: [SNAPSHOT_ID],
          })));

          numberOfRecordsBefore = await collection.find({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }).count();

          (record = await subject.save(new Version({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: UPDATED_CONTENT,
            fetchDate: FETCH_DATE,
            snapshotIds: [SNAPSHOT_ID],
          })));

          numberOfRecordsAfter = await collection.find({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }).count();

          ([mongoDocument] = await collection.find({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }).limit(1).sort({ created_at: -1 }).toArray());
        });

        after(async () => subject.removeAll());

        it('saves the record', () => {
          expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
        });

        it('returns the record id', () => {
          expect(mongoDocument._id.toString()).to.equal(record.id);
        });

        it('states that it is not the first record', () => {
          expect(record.isFirstRecord).to.be.false;
        });
      });

      context('when the content has not changed', () => {
        before(async () => {
          await subject.save(new Version({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            fetchDate: FETCH_DATE,
            snapshotIds: [SNAPSHOT_ID],
          }));

          numberOfRecordsBefore = await collection.find({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }).count();

          (record = await subject.save(new Version({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            fetchDate: FETCH_DATE_LATER,
            snapshotIds: [SNAPSHOT_ID],
          })));

          numberOfRecordsAfter = await collection.find({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
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

      context('when it is an extracted only version', () => {
        const EXTRACTED_ONLY_CONTENT = `${CONTENT} extracted only`;

        before(async () => {
          await subject.save(new Version({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            fetchDate: FETCH_DATE_EARLIER,
            snapshotIds: [SNAPSHOT_ID],
          })); // An extracted only version cannot be the first record

          numberOfRecordsBefore = await collection.find({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }).count();

          (record = await subject.save(new Version({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: EXTRACTED_ONLY_CONTENT,
            fetchDate: FETCH_DATE,
            snapshotIds: [SNAPSHOT_ID],
            isExtractOnly: true,
          })));

          numberOfRecordsAfter = await collection.find({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }).count();

          ([mongoDocument] = await collection.find({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }).limit(1).sort({ created_at: -1 }).toArray());
        });

        after(async () => subject.removeAll());

        it('saves the record', () => {
          expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
        });

        it('returns the record id', () => {
          expect(mongoDocument._id.toString()).to.equal(record.id);
        });

        it('stores information that it is an extracted only version', () => {
          expect(mongoDocument.isExtractOnly).to.be.true;
        });
      });

      context('when one snapshot ID is specified', () => {
        before(async () => {
          (record = await subject.save(new Version({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            fetchDate: FETCH_DATE,
            snapshotIds: [SNAPSHOT_ID],
          })));

          (mongoDocument = await collection.findOne({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }));
        });

        after(async () => subject.removeAll());

        it('stores snapshot ID', () => {
          const snapshotIds = mongoDocument.snapshotIds.map(id => id.toString());

          expect(snapshotIds).to.include(SNAPSHOT_ID);
        });

        it('stores the service ID', () => {
          expect(mongoDocument.serviceId).to.include(SERVICE_PROVIDER_ID);
        });

        it('stores the terms type', () => {
          expect(mongoDocument.termsType).to.include(TERMS_TYPE);
        });
      });

      context('when there are many snapshots IDs specified', () => {
        const SNAPSHOT_ID_1 = '61af86dc5ff5caa74ae926ad';
        const SNAPSHOT_ID_2 = '630cdfa67d2e3cc51f6e284c';

        before(async () => {
          (record = await subject.save(new Version({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            fetchDate: FETCH_DATE,
            snapshotIds: [ SNAPSHOT_ID_1, SNAPSHOT_ID_2 ],
          })));

          (mongoDocument = await collection.findOne({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }));
        });

        after(async () => subject.removeAll());

        it('stores snapshots IDs', () => {
          const snapshotIds = mongoDocument.snapshotIds.map(id => id.toString());

          expect(snapshotIds).to.include(SNAPSHOT_ID_1);
          expect(snapshotIds).to.include(SNAPSHOT_ID_2);
        });

        it('stores the service ID', () => {
          expect(mongoDocument.serviceId).to.include(SERVICE_PROVIDER_ID);
        });

        it('stores the terms type', () => {
          expect(mongoDocument.termsType).to.include(TERMS_TYPE);
        });
      });
    });

    describe('#findById', () => {
      let record;
      let id;

      before(async () => {
        ({ id } = await subject.save(new Version({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: CONTENT,
          fetchDate: FETCH_DATE,
          snapshotIds: [SNAPSHOT_ID],
        })));

        (record = await subject.findById(id));
      });

      after(async () => subject.removeAll());

      it('returns a Version object', () => {
        expect(record).to.be.an.instanceof(Version);
      });

      it('returns the record id', () => {
        expect(record.id).to.include(id);
      });

      it('states that it is the first record', () => {
        expect(record.isFirstRecord).to.be.true;
      });

      it('returns the service ID', () => {
        expect(record.serviceId).to.equal(SERVICE_PROVIDER_ID);
      });

      it('returns the terms type', () => {
        expect(record.termsType).to.equal(TERMS_TYPE);
      });

      it('returns the content', async () => {
        expect(record.content).to.equal(CONTENT);
      });

      it('returns the fetch date', () => {
        expect(new Date(record.fetchDate).getTime()).to.equal(FETCH_DATE.getTime());
      });

      it('returns the snapshot ID', () => {
        expect(record.snapshotIds).to.deep.equal([SNAPSHOT_ID]);
      });

      context('when requested record does not exist', () => {
        it('returns null', async () => {
          expect(await subject.findById('inexistantID')).to.equal(null);
        });
      });
    });

    describe('#findAll', () => {
      let records;
      const expectedIds = [];

      before(async () => {
        const { id: id1 } = await subject.save(new Version({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: CONTENT,
          fetchDate: FETCH_DATE,
          snapshotIds: [SNAPSHOT_ID],
        }));

        expectedIds.push(id1);

        const { id: id2 } = await subject.save(new Version({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: `${CONTENT} - updated`,
          fetchDate: FETCH_DATE_LATER,
          snapshotIds: [SNAPSHOT_ID],
        }));

        expectedIds.push(id2);

        const { id: id3 } = await subject.save(new Version({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: `${CONTENT} - updated 2`,
          isExtractOnly: true,
          fetchDate: FETCH_DATE_EARLIER,
          snapshotIds: [SNAPSHOT_ID],
        }));

        expectedIds.push(id3);

        (records = await subject.findAll());
      });

      after(async () => subject.removeAll());

      it('returns all records', () => {
        expect(records.length).to.equal(3);
      });

      it('returns Version objects', () => {
        for (const record of records) {
          expect(record).to.be.an.instanceof(Version);
        }
      });

      it('returns records in ascending order', async () => {
        expect(records.map(record => record.fetchDate)).to.deep.equal([ FETCH_DATE_EARLIER, FETCH_DATE, FETCH_DATE_LATER ]);
      });
    });

    describe('#count', () => {
      let count;

      before(async () => {
        await subject.save(new Version({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: CONTENT,
          fetchDate: FETCH_DATE,
          snapshotIds: [SNAPSHOT_ID],
        }));
        await subject.save(new Version({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: `${CONTENT} - updated`,
          fetchDate: FETCH_DATE_LATER,
          snapshotIds: [SNAPSHOT_ID],
        }));
        await subject.save(new Version({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: `${CONTENT} - updated 2`,
          isExtractOnly: true,
          fetchDate: FETCH_DATE_EARLIER,
          snapshotIds: [SNAPSHOT_ID],
        }));

        (count = await subject.count());
      });

      after(async () => subject.removeAll());

      it('returns the proper count', async () => {
        expect(count).to.equal(3);
      });
    });

    describe('#findLatest', () => {
      context('when there are records for the given service', () => {
        let lastSnapshotId;
        let latestRecord;

        context('with HTML document', () => {
          const UPDATED_CONTENT = `${CONTENT} (with additional content to trigger a record)`;

          before(async () => {
            await subject.save(new Version({
              serviceId: SERVICE_PROVIDER_ID,
              termsType: TERMS_TYPE,
              content: CONTENT,
              fetchDate: FETCH_DATE,
              snapshotIds: [SNAPSHOT_ID],
            }));

            ({ id: lastSnapshotId } = await subject.save(new Version({
              serviceId: SERVICE_PROVIDER_ID,
              termsType: TERMS_TYPE,
              content: UPDATED_CONTENT,
              fetchDate: FETCH_DATE_LATER,
              snapshotIds: [SNAPSHOT_ID],
            })));

            latestRecord = await subject.findLatest(
              SERVICE_PROVIDER_ID,
              TERMS_TYPE,
            );
          });

          after(async () => subject.removeAll());

          it('returns a Version object', () => {
            expect(latestRecord).to.be.an.instanceof(Version);
          });

          it('returns the latest record id', () => {
            expect(latestRecord.id).to.include(lastSnapshotId);
          });

          it('returns the latest record content', async () => {
            expect((await latestRecord.content).toString('utf8')).to.equal(UPDATED_CONTENT);
          });
        });
      });

      context('when there are no records for the given service', () => {
        let latestRecord;

        before(async () => {
          latestRecord = await subject.findLatest(SERVICE_PROVIDER_ID, TERMS_TYPE);
        });

        it('returns null', async () => {
          expect(latestRecord).to.equal(null);
        });
      });
    });

    describe('#iterate', () => {
      const expectedIds = [];
      const ids = [];
      const fetchDates = [];

      before(async () => {
        const { id: id1 } = await subject.save(new Version({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: CONTENT,
          fetchDate: FETCH_DATE,
          snapshotIds: [SNAPSHOT_ID],
        }));

        expectedIds.push(id1);

        const { id: id2 } = await subject.save(new Version({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: `${CONTENT} - updated`,
          fetchDate: FETCH_DATE_LATER,
          snapshotIds: [SNAPSHOT_ID],
        }));

        expectedIds.push(id2);

        const { id: id3 } = await subject.save(new Version({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: `${CONTENT} - updated 2`,
          isExtractOnly: true,
          fetchDate: FETCH_DATE_EARLIER,
          snapshotIds: [SNAPSHOT_ID],
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

  context('Snapshot', () => {
    before(async () => {
      subject = new MongoRepository(config.get('recorder.snapshots.storage.mongo'));
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
            termsType: TERMS_TYPE,
          }).count();

          (record = await subject.save(new Snapshot({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            documentId: DOCUMENT_ID,
            content: CONTENT,
            mimeType: HTML_MIME_TYPE,
            fetchDate: FETCH_DATE,
          })));

          numberOfRecordsAfter = await collection.find({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }).count();

          (mongoDocument = await collection.findOne({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }));
        });

        after(async () => subject.removeAll());

        it('saves the record', () => {
          expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
        });

        it('returns the record id', () => {
          expect(mongoDocument._id.toString()).to.equal(record.id);
        });

        it('states that it is the first record', () => {
          expect(record.isFirstRecord).to.be.true;
        });

        it('stores the service ID', () => {
          expect(mongoDocument.serviceId).to.include(SERVICE_PROVIDER_ID);
        });

        it('stores the terms type', () => {
          expect(mongoDocument.termsType).to.include(TERMS_TYPE);
        });

        it('stores information that it is the first record for these specific terms', () => {
          expect(mongoDocument.isFirstRecord).to.be.true;
        });

        it('stores the proper content', () => {
          expect(mongoDocument.content).to.equal(CONTENT);
        });

        it('stores the fetch date', () => {
          expect(new Date(mongoDocument.fetchDate).getTime()).to.equal(FETCH_DATE.getTime());
        });

        it('stores the MIME type', () => {
          expect(mongoDocument.mimeType).to.equal(HTML_MIME_TYPE);
        });

        it('stores the document ID', () => {
          expect(mongoDocument.documentId).to.equal(DOCUMENT_ID);
        });
      });

      context('when it is not the first record', () => {
        const UPDATED_CONTENT = `${CONTENT} updated`;

        before(async () => {
          (record = await subject.save(new Snapshot({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            mimeType: HTML_MIME_TYPE,
            fetchDate: FETCH_DATE,
          })));

          numberOfRecordsBefore = await collection.find({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }).count();

          (record = await subject.save(new Snapshot({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: UPDATED_CONTENT,
            mimeType: HTML_MIME_TYPE,
            fetchDate: FETCH_DATE,
          })));

          numberOfRecordsAfter = await collection.find({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }).count();

          ([mongoDocument] = await collection.find({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }).limit(1).sort({ created_at: -1 }).toArray());
        });

        after(async () => subject.removeAll());

        it('saves the record', () => {
          expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
        });

        it('returns the record id', () => {
          expect(mongoDocument._id.toString()).to.equal(record.id);
        });

        it('states that it is not the first record', () => {
          expect(record.isFirstRecord).to.be.false;
        });
      });

      context('when the content has not changed', () => {
        before(async () => {
          await subject.save(new Snapshot({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            mimeType: HTML_MIME_TYPE,
            fetchDate: FETCH_DATE,
          }));

          numberOfRecordsBefore = await collection.find({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }).count();

          (record = await subject.save(new Snapshot({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            mimeType: HTML_MIME_TYPE,
            fetchDate: FETCH_DATE_LATER,
          })));

          numberOfRecordsAfter = await collection.find({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
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

      context('with PDF document', () => {
        before(async () => {
          numberOfRecordsBefore = await collection.find({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: PDF_CONTENT,
            mimeType: PDF_MIME_TYPE,
          }).count();

          (record = await subject.save(new Snapshot({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: PDF_CONTENT,
            mimeType: PDF_MIME_TYPE,
            fetchDate: FETCH_DATE,
          })));

          numberOfRecordsAfter = await collection.find({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
          }).count();

          (mongoDocument = await collection.findOne({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
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

        it('stores the MIME type', () => {
          expect(mongoDocument.mimeType).to.equal(PDF_MIME_TYPE);
        });
      });
    });

    describe('#findById', () => {
      let record;
      let id;

      before(async () => {
        ({ id } = await subject.save(new Snapshot({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          documentId: DOCUMENT_ID,
          content: CONTENT,
          fetchDate: FETCH_DATE,
          mimeType: HTML_MIME_TYPE,
        })));

        (record = await subject.findById(id));
      });

      after(async () => subject.removeAll());

      it('returns a Snapshot object', () => {
        expect(record).to.be.an.instanceof(Snapshot);
      });

      it('returns the record id', () => {
        expect(record.id).to.include(id);
      });

      it('states that it is the first record', () => {
        expect(record.isFirstRecord).to.be.true;
      });

      it('returns the service ID', () => {
        expect(record.serviceId).to.equal(SERVICE_PROVIDER_ID);
      });

      it('returns the terms type', () => {
        expect(record.termsType).to.equal(TERMS_TYPE);
      });

      it('returns the content', async () => {
        expect(record.content).to.equal(CONTENT);
      });

      it('returns the fetch date', () => {
        expect(new Date(record.fetchDate).getTime()).to.equal(FETCH_DATE.getTime());
      });

      it('returns the MIME type', () => {
        expect(record.mimeType).to.equal(HTML_MIME_TYPE);
      });

      it('returns the document ID', () => {
        expect(record.documentId).to.equal(DOCUMENT_ID);
      });

      context('when requested record does not exist', () => {
        it('returns null', async () => {
          expect(await subject.findById('inexistantID')).to.equal(null);
        });
      });
    });

    describe('#findAll', () => {
      let records;
      const expectedIds = [];

      before(async () => {
        const { id: id1 } = await subject.save(new Snapshot({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: CONTENT,
          fetchDate: FETCH_DATE,
          mimeType: HTML_MIME_TYPE,
        }));

        expectedIds.push(id1);

        const { id: id2 } = await subject.save(new Snapshot({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: `${CONTENT} - updated`,
          fetchDate: FETCH_DATE_LATER,
          mimeType: HTML_MIME_TYPE,
        }));

        expectedIds.push(id2);

        const { id: id3 } = await subject.save(new Snapshot({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: `${CONTENT} - updated 2`,
          isExtractOnly: true,
          fetchDate: FETCH_DATE_EARLIER,
          mimeType: HTML_MIME_TYPE,
        }));

        expectedIds.push(id3);

        (records = await subject.findAll());
      });

      after(async () => subject.removeAll());

      it('returns all records', () => {
        expect(records.length).to.equal(3);
      });

      it('returns Snapshot objects', () => {
        for (const record of records) {
          expect(record).to.be.an.instanceof(Snapshot);
        }
      });

      it('returns records in ascending order', async () => {
        expect(records.map(record => record.fetchDate)).to.deep.equal([ FETCH_DATE_EARLIER, FETCH_DATE, FETCH_DATE_LATER ]);
      });
    });

    describe('#count', () => {
      let count;

      before(async () => {
        await subject.save(new Snapshot({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: CONTENT,
          fetchDate: FETCH_DATE,
          mimeType: HTML_MIME_TYPE,
        }));
        await subject.save(new Snapshot({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: `${CONTENT} - updated`,
          fetchDate: FETCH_DATE_LATER,
          mimeType: HTML_MIME_TYPE,
        }));
        await subject.save(new Snapshot({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: `${CONTENT} - updated 2`,
          isExtractOnly: true,
          fetchDate: FETCH_DATE_EARLIER,
          mimeType: HTML_MIME_TYPE,
        }));

        (count = await subject.count());
      });

      after(async () => subject.removeAll());

      it('returns the proper count', async () => {
        expect(count).to.equal(3);
      });
    });

    describe('#findLatest', () => {
      context('when there are records for the given service', () => {
        let lastSnapshotId;
        let latestRecord;

        context('with HTML document', () => {
          const UPDATED_CONTENT = `${CONTENT} (with additional content to trigger a record)`;

          before(async () => {
            await subject.save(new Snapshot({
              serviceId: SERVICE_PROVIDER_ID,
              termsType: TERMS_TYPE,
              content: CONTENT,
              fetchDate: FETCH_DATE,
              mimeType: HTML_MIME_TYPE,
            }));

            ({ id: lastSnapshotId } = await subject.save(new Snapshot({
              serviceId: SERVICE_PROVIDER_ID,
              termsType: TERMS_TYPE,
              content: UPDATED_CONTENT,
              mimeType: HTML_MIME_TYPE,
              fetchDate: FETCH_DATE_LATER,
            })));

            latestRecord = await subject.findLatest(
              SERVICE_PROVIDER_ID,
              TERMS_TYPE,
            );
          });

          after(async () => subject.removeAll());

          it('returns a Snapshot object', () => {
            expect(latestRecord).to.be.an.instanceof(Snapshot);
          });

          it('returns the latest record id', () => {
            expect(latestRecord.id).to.include(lastSnapshotId);
          });

          it('returns the latest record content', async () => {
            expect((await latestRecord.content).toString('utf8')).to.equal(UPDATED_CONTENT);
          });

          it('returns the latest record mime type', () => {
            expect(latestRecord.mimeType).to.equal(HTML_MIME_TYPE);
          });
        });

        context('with PDF document', () => {
          before(async () => {
            await subject.save(new Snapshot({
              serviceId: SERVICE_PROVIDER_ID,
              termsType: TERMS_TYPE,
              content: PDF_CONTENT,
              mimeType: PDF_MIME_TYPE,
              fetchDate: FETCH_DATE,
            }));

            ({ id: lastSnapshotId } = await subject.save(new Snapshot({
              serviceId: SERVICE_PROVIDER_ID,
              termsType: TERMS_TYPE,
              content: UPDATED_PDF_CONTENT,
              mimeType: PDF_MIME_TYPE,
              fetchDate: FETCH_DATE_LATER,
            })));

            latestRecord = await subject.findLatest(SERVICE_PROVIDER_ID, TERMS_TYPE);
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
          latestRecord = await subject.findLatest(SERVICE_PROVIDER_ID, TERMS_TYPE);
        });

        it('returns null', async () => {
          expect(latestRecord).to.equal(null);
        });
      });
    });

    describe('#iterate', () => {
      const expectedIds = [];
      const ids = [];
      const fetchDates = [];

      before(async () => {
        const { id: id1 } = await subject.save(new Snapshot({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: CONTENT,
          fetchDate: FETCH_DATE,
          mimeType: HTML_MIME_TYPE,
        }));

        expectedIds.push(id1);

        const { id: id2 } = await subject.save(new Snapshot({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: `${CONTENT} - updated`,
          fetchDate: FETCH_DATE_LATER,
          mimeType: HTML_MIME_TYPE,
        }));

        expectedIds.push(id2);

        const { id: id3 } = await subject.save(new Snapshot({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: `${CONTENT} - updated 2`,
          isExtractOnly: true,
          fetchDate: FETCH_DATE_EARLIER,
          mimeType: HTML_MIME_TYPE,
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
});
