import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import chai from 'chai';
import config from 'config';
import mime from 'mime';

import Snapshot from '../../snapshot.js';
import Version from '../../version.js';

import { TERMS_TYPE_AND_DOCUMENT_ID_SEPARATOR, SNAPSHOT_ID_MARKER, COMMIT_MESSAGE_PREFIXES } from './dataMapper.js';
import Git from './git.js';

import GitRepository from './index.js';

const { expect } = chai;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RECORDER_PATH = path.resolve(__dirname, '../../../../..', config.get('recorder.versions.storage.git.path'));

const SERVICE_PROVIDER_ID = 'test_service';
const TERMS_TYPE = 'Terms of Service';
const DOCUMENT_ID = '126382350847838';
const CONTENT = 'ToS fixture data with UTF-8 çhãràčtęrs';

const BASE_PATH = `${RECORDER_PATH}/${SERVICE_PROVIDER_ID}/${TERMS_TYPE}`;
const EXPECTED_VERSION_FILE_PATH = `${BASE_PATH}.md`;
const EXPECTED_SNAPSHOT_FILE_PATH = `${BASE_PATH}.html`;
const EXPECTED_SNAPSHOT_FILE_PATH_WITH_DOCUMENT_ID = `${BASE_PATH}${TERMS_TYPE_AND_DOCUMENT_ID_SEPARATOR}${DOCUMENT_ID}.html`;
const EXPECTED_PDF_SNAPSHOT_FILE_PATH = `${BASE_PATH}.pdf`;

const FETCH_DATE = new Date('2000-01-01T12:00:00.000Z');
const FETCH_DATE_LATER = new Date('2000-01-02T12:00:00.000Z');
const FETCH_DATE_EARLIER = new Date('2000-01-01T06:00:00.000Z');

const SNAPSHOT_ID = '513fadb2ae415c87747047e33287805d59e2dd55';
const HTML_MIME_TYPE = mime.getType('html');

const PDF_MIME_TYPE = mime.getType('pdf');
const PDF_CONTENT = fs.readFileSync(path.resolve(__dirname, '../../../../../test/fixtures/terms.pdf'), { encoding: 'utf8' });

describe('GitRepository', () => {
  let git;
  let subject;

  context('Version', () => {
    before(async function () {
      this.timeout(5000);

      git = new Git({
        path: RECORDER_PATH,
        author: {
          name: config.get('recorder.versions.storage.git.author.name'),
          email: config.get('recorder.versions.storage.git.author.email'),
        },
      });

      await git.initialize();

      subject = new GitRepository({
        ...config.get('recorder.versions.storage.git'),
        path: RECORDER_PATH,
      });

      return subject.initialize();
    });

    describe('#save', () => {
      let id;
      let commit;
      let isFirstRecord;
      let numberOfRecordsBefore;
      let numberOfRecordsAfter;

      context('when it is the first record', () => {
        before(async () => {
          numberOfRecordsBefore = (await git.log()).length;

          ({ id, isFirstRecord } = await subject.save(new Version({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            fetchDate: FETCH_DATE,
            snapshotIds: [SNAPSHOT_ID],
          })));

          numberOfRecordsAfter = (await git.log()).length;

          ([commit] = await git.log());
        });

        after(() => subject.removeAll());

        it('saves the record', () => {
          expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
        });

        it('returns the record id', () => {
          expect(commit.hash).to.include(id);
        });

        it('states that it is the first record', () => {
          expect(isFirstRecord).to.be.true;
        });

        it('stores the service ID', () => {
          expect(commit.message).to.include(SERVICE_PROVIDER_ID);
        });

        it('stores the terms type', () => {
          expect(commit.message).to.include(TERMS_TYPE);
        });

        it('stores information that it is the first record for these specific terms', () => {
          expect(commit.message).to.include(COMMIT_MESSAGE_PREFIXES.startTracking);
        });

        it('stores the proper content', () => {
          expect(fs.readFileSync(EXPECTED_VERSION_FILE_PATH, { encoding: 'utf8' })).to.equal(CONTENT);
        });

        it('stores the fetch date', () => {
          expect(new Date(commit.date).getTime()).to.equal(FETCH_DATE.getTime());
        });

        it('stores the snapshot ID', () => {
          expect(commit.body).to.include(SNAPSHOT_ID);
        });
      });

      context('when it is not the first record', () => {
        const UPDATED_CONTENT = `${CONTENT} updated`;

        before(async () => {
          await subject.save(new Version({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            mimeType: HTML_MIME_TYPE,
            fetchDate: FETCH_DATE,
          }));

          numberOfRecordsBefore = (await git.log()).length;

          ({ id, isFirstRecord } = await subject.save(new Version({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: UPDATED_CONTENT,
            fetchDate: FETCH_DATE,
            snapshotIds: [SNAPSHOT_ID],
            mimeType: HTML_MIME_TYPE,
          })));

          numberOfRecordsAfter = (await git.log()).length;

          ([commit] = await git.log());
        });

        after(() => subject.removeAll());

        it('saves the record', () => {
          expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
        });

        it('returns the record id', () => {
          expect(commit.hash).to.include(id);
        });

        it('states that it is not the first record', () => {
          expect(isFirstRecord).to.be.false;
        });
      });

      context('when the content has not changed', () => {
        before(async () => {
          await subject.save(new Version({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            fetchDate: FETCH_DATE,
          }));

          numberOfRecordsBefore = (await git.log()).length;

          ({ id, isFirstRecord } = await subject.save(new Version({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            fetchDate: FETCH_DATE,
          })));

          numberOfRecordsAfter = (await git.log()).length;
        });

        after(() => subject.removeAll());

        it('does not save the record', () => {
          expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore);
        });

        it('returns no id', () => {
          expect(id).to.equal(undefined);
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
          })); // An extracted only version cannot be the first record

          numberOfRecordsBefore = (await git.log()).length;

          ({ id, isFirstRecord } = await subject.save(new Version({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: EXTRACTED_ONLY_CONTENT,
            fetchDate: FETCH_DATE,
            isExtractOnly: true,
            snapshotIds: [SNAPSHOT_ID],
          })));

          numberOfRecordsAfter = (await git.log()).length;

          ([commit] = await git.log());
        });

        after(() => subject.removeAll());

        it('saves the record', () => {
          expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
        });

        it('returns the record id', () => {
          expect(commit.hash).to.include(id);
        });

        it('stores information that it is an extracted only version', () => {
          expect(commit.message).to.include(COMMIT_MESSAGE_PREFIXES.extractOnly);
        });
      });

      context('when one snapshot ID is specified', () => {
        const SNAPSHOT_ID = 'c01533c0e546ef430eea84d23c1b18a2b8420dfb';
        const snapshotIds = [SNAPSHOT_ID];

        before(async () => {
          ({ id, isFirstRecord } = await subject.save(new Version({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            fetchDate: FETCH_DATE,
            snapshotIds,
          })));

          ([commit] = await git.log());
        });

        after(() => subject.removeAll());

        it('stores snapshot ID', () => {
          expect(commit.body).to.include(config.get('recorder.versions.storage.git.snapshotIdentiferTemplate').replace(SNAPSHOT_ID_MARKER, SNAPSHOT_ID));
        });

        it('stores the service ID', () => {
          expect(commit.message).to.include(SERVICE_PROVIDER_ID);
        });

        it('stores the terms type', () => {
          expect(commit.message).to.include(TERMS_TYPE);
        });
      });

      context('when there are many snapshots IDs specified', () => {
        const SNAPSHOT_ID_1 = 'c01533c0e546ef430eea84d23c1b18a2b8420dfb';
        const SNAPSHOT_ID_2 = '0fd16cca9e1a86a2267bd587107c485f06099d7d';
        const snapshotIds = [ SNAPSHOT_ID_1, SNAPSHOT_ID_2 ];

        before(async () => {
          ({ id, isFirstRecord } = await subject.save(new Version({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            fetchDate: FETCH_DATE,
            snapshotIds,
          })));

          ([commit] = await git.log());
        });

        after(() => subject.removeAll());

        it('stores snapshots IDs', () => {
          expect(commit.body).to.include(config.get('recorder.versions.storage.git.snapshotIdentiferTemplate').replace(SNAPSHOT_ID_MARKER, SNAPSHOT_ID_1));
          expect(commit.body).to.include(config.get('recorder.versions.storage.git.snapshotIdentiferTemplate').replace(SNAPSHOT_ID_MARKER, SNAPSHOT_ID_2));
        });

        it('stores the number of source documents', () => {
          expect(commit.body).to.include(`${snapshotIds.length} source documents`);
        });

        it('stores the service ID', () => {
          expect(commit.message).to.include(SERVICE_PROVIDER_ID);
        });

        it('stores the terms type', () => {
          expect(commit.message).to.include(TERMS_TYPE);
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
          mimeType: HTML_MIME_TYPE,
        })));

        (record = await subject.findById(id));
      });

      after(() => subject.removeAll());

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

      it('returns the content', () => {
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

    describe('#findByDate', () => {
      context('when there are records for the given service', () => {
        let recordToFindId;
        let recordFound;

        context('when a record exists for the requested service and date', () => {
          const UPDATED_FILE_CONTENT = `${CONTENT} (with additional content to trigger a record)`;

          before(async () => {
            await subject.save(new Version({
              serviceId: SERVICE_PROVIDER_ID,
              termsType: TERMS_TYPE,
              content: CONTENT,
              fetchDate: FETCH_DATE_EARLIER,
              snapshotIds: [SNAPSHOT_ID],
            }));

            ({ id: recordToFindId } = await subject.save(new Version({
              serviceId: SERVICE_PROVIDER_ID,
              termsType: TERMS_TYPE,
              content: UPDATED_FILE_CONTENT,
              fetchDate: FETCH_DATE,
              snapshotIds: [SNAPSHOT_ID],
            })));

            await subject.save(new Version({
              serviceId: SERVICE_PROVIDER_ID,
              termsType: TERMS_TYPE,
              content: `${CONTENT}CONTENT`,
              fetchDate: FETCH_DATE_LATER,
              snapshotIds: [SNAPSHOT_ID],
            }));

            const oneHourBeforeFetchDateLater = new Date(FETCH_DATE_LATER.getTime() - 60 * 60 * 1000);

            recordFound = await subject.findByDate(SERVICE_PROVIDER_ID, TERMS_TYPE, oneHourBeforeFetchDateLater);
          });

          after(() => subject.removeAll());

          it('returns a Version object', () => {
            expect(recordFound).to.be.an.instanceof(Version);
          });

          it('returns the latest record id', () => {
            expect(recordFound.id).to.include(recordToFindId);
          });
        });
      });

      context('when there are no records for the given service', () => {
        let recordFound;

        before(async () => {
          recordFound = await subject.findByDate(SERVICE_PROVIDER_ID, TERMS_TYPE);
        });

        it('returns null', () => {
          expect(recordFound).to.equal(null);
        });
      });
    });

    describe('#findAll', () => {
      let records;
      const expectedIds = [];

      before(async function () {
        this.timeout(5000);

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

      after(() => subject.removeAll());

      it('returns all records', () => {
        expect(records.length).to.equal(3);
      });

      it('returns Version objects', () => {
        for (const record of records) {
          expect(record).to.be.an.instanceof(Version);
        }
      });

      it('returns records in ascending order', () => {
        expect(records.map(record => record.fetchDate)).to.deep.equal([ FETCH_DATE_EARLIER, FETCH_DATE, FETCH_DATE_LATER ]);
      });
    });

    describe('#count', () => {
      let count;

      before(async function () {
        this.timeout(5000);

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

      after(() => subject.removeAll());

      it('returns the proper count', () => {
        expect(count).to.equal(3);
      });
    });

    describe('#findLatest', () => {
      context('when there are records for the given service', () => {
        let lastSnapshotId;
        let latestRecord;

        context('with HTML document', () => {
          const UPDATED_FILE_CONTENT = `${CONTENT} (with additional content to trigger a record)`;

          before(async () => {
            await subject.save(new Version({
              serviceId: SERVICE_PROVIDER_ID,
              termsType: TERMS_TYPE,
              content: CONTENT,
              fetchDate: FETCH_DATE_EARLIER,
              snapshotIds: [SNAPSHOT_ID],
            }));

            ({ id: lastSnapshotId } = await subject.save(new Version({
              serviceId: SERVICE_PROVIDER_ID,
              termsType: TERMS_TYPE,
              content: UPDATED_FILE_CONTENT,
              fetchDate: FETCH_DATE,
              snapshotIds: [SNAPSHOT_ID],
            })));

            latestRecord = await subject.findLatest(SERVICE_PROVIDER_ID, TERMS_TYPE);
          });

          after(() => subject.removeAll());

          it('returns a Version object', () => {
            expect(latestRecord).to.be.an.instanceof(Version);
          });

          it('returns the latest record id', () => {
            expect(latestRecord.id).to.include(lastSnapshotId);
          });

          it('returns the latest record content', () => {
            expect(latestRecord.content.toString('utf8')).to.equal(UPDATED_FILE_CONTENT);
          });
        });
      });

      context('when there are no records for the given service', () => {
        let latestRecord;

        before(async () => {
          latestRecord = await subject.findLatest(SERVICE_PROVIDER_ID, TERMS_TYPE);
        });

        it('returns null', () => {
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
          mimeType: HTML_MIME_TYPE,
        }));

        expectedIds.push(id1);

        const { id: id2 } = await subject.save(new Version({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: `${CONTENT} - updated`,
          fetchDate: FETCH_DATE_LATER,
          snapshotIds: [SNAPSHOT_ID],
          mimeType: HTML_MIME_TYPE,
        }));

        expectedIds.push(id2);

        const { id: id3 } = await subject.save(new Version({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: `${CONTENT} - updated 2`,
          isExtractOnly: true,
          fetchDate: FETCH_DATE_EARLIER,
          snapshotIds: [SNAPSHOT_ID],
          mimeType: HTML_MIME_TYPE,
        }));

        expectedIds.push(id3);

        for await (const record of subject.iterate()) {
          ids.push(record.id);
          fetchDates.push(record.fetchDate);
        }
      });

      after(() => subject.removeAll());

      it('iterates through all records', () => {
        expect(ids).to.have.members(expectedIds);
      });

      it('iterates in ascending order', () => {
        expect(fetchDates).to.deep.equal([ FETCH_DATE_EARLIER, FETCH_DATE, FETCH_DATE_LATER ]);
      });
    });
  });

  context('Snapshot', () => {
    before(async function () {
      this.timeout(5000);
      git = new Git({
        path: RECORDER_PATH,
        author: {
          name: config.get('recorder.snapshots.storage.git.author.name'),
          email: config.get('recorder.snapshots.storage.git.author.email'),
        },
      });

      await git.initialize();

      subject = new GitRepository({
        ...config.get('recorder.snapshots.storage.git'),
        path: RECORDER_PATH,
      });

      return subject.initialize();
    });

    describe('#save', () => {
      let id;
      let commit;
      let isFirstRecord;
      let numberOfRecordsBefore;
      let numberOfRecordsAfter;

      context('when it is the first record', () => {
        before(async () => {
          numberOfRecordsBefore = (await git.log()).length;

          ({ id, isFirstRecord } = await subject.save(new Snapshot({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            documentId: DOCUMENT_ID,
            content: CONTENT,
            fetchDate: FETCH_DATE,
            mimeType: HTML_MIME_TYPE,
          })));

          numberOfRecordsAfter = (await git.log()).length;

          ([commit] = await git.log());
        });

        after(() => subject.removeAll());

        it('saves the record', () => {
          expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
        });

        it('returns the record id', () => {
          expect(commit.hash).to.include(id);
        });

        it('states that it is the first record', () => {
          expect(isFirstRecord).to.be.true;
        });

        it('stores the service ID', () => {
          expect(commit.message).to.include(SERVICE_PROVIDER_ID);
        });

        it('stores the terms type', () => {
          expect(commit.message).to.include(TERMS_TYPE);
        });

        it('stores information that it is the first record for these specific terms', () => {
          expect(commit.message).to.include(COMMIT_MESSAGE_PREFIXES.startTracking);
        });

        it('stores the proper content', () => {
          expect(fs.readFileSync(EXPECTED_SNAPSHOT_FILE_PATH_WITH_DOCUMENT_ID, { encoding: 'utf8' })).to.equal(CONTENT);
        });

        it('stores the fetch date', () => {
          expect(new Date(commit.date).getTime()).to.equal(FETCH_DATE.getTime());
        });

        it('stores the MIME type', () => {
          expect(mime.getType(EXPECTED_SNAPSHOT_FILE_PATH_WITH_DOCUMENT_ID)).to.equal(HTML_MIME_TYPE);
        });

        it('stores the document ID', () => {
          expect(commit.body).to.include(DOCUMENT_ID);
        });
      });

      context('when it is not the first record', () => {
        const UPDATED_CONTENT = `${CONTENT} updated`;

        before(async () => {
          await subject.save(new Snapshot({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            mimeType: HTML_MIME_TYPE,
            fetchDate: FETCH_DATE,
          }));

          numberOfRecordsBefore = (await git.log()).length;

          ({ id, isFirstRecord } = await subject.save(new Snapshot({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: UPDATED_CONTENT,
            fetchDate: FETCH_DATE,
            mimeType: HTML_MIME_TYPE,
          })));

          numberOfRecordsAfter = (await git.log()).length;

          ([commit] = await git.log());
        });

        after(() => subject.removeAll());

        it('saves the record', () => {
          expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
        });

        it('returns the record id', () => {
          expect(commit.hash).to.include(id);
        });

        it('states that it is not the first record', () => {
          expect(isFirstRecord).to.be.false;
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

          numberOfRecordsBefore = (await git.log()).length;

          ({ id, isFirstRecord } = await subject.save(new Snapshot({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            mimeType: HTML_MIME_TYPE,
            fetchDate: FETCH_DATE,
          })));

          numberOfRecordsAfter = (await git.log()).length;
        });

        after(() => subject.removeAll());

        it('does not save the record', () => {
          expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore);
        });

        it('returns no id', () => {
          expect(id).to.equal(undefined);
        });
      });

      context('when there are no document ID specified', () => {
        before(async () => {
          numberOfRecordsBefore = (await git.log()).length;

          ({ id, isFirstRecord } = await subject.save(new Snapshot({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            fetchDate: FETCH_DATE,
            mimeType: HTML_MIME_TYPE,
          })));

          numberOfRecordsAfter = (await git.log()).length;

          ([commit] = await git.log());
        });

        after(() => subject.removeAll());

        it('saves the record', () => {
          expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
        });

        it('returns the record id', () => {
          expect(commit.hash).to.include(id);
        });

        it('stores the proper content under the proper file path', () => {
          expect(fs.readFileSync(EXPECTED_SNAPSHOT_FILE_PATH, { encoding: 'utf8' })).to.equal(CONTENT);
        });
      });

      context('with PDF document', () => {
        before(async () => {
          numberOfRecordsBefore = (await git.log()).length;

          ({ id, isFirstRecord } = await subject.save(new Snapshot({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: PDF_CONTENT,
            fetchDate: FETCH_DATE,
            mimeType: PDF_MIME_TYPE,
          })));

          numberOfRecordsAfter = (await git.log()).length;

          ([commit] = await git.log());
        });

        after(() => subject.removeAll());

        it('saves the record', () => {
          expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
        });

        it('returns the record id', () => {
          expect(commit.hash).to.include(id);
        });

        it('stores the proper content', () => {
          expect(fs.readFileSync(EXPECTED_PDF_SNAPSHOT_FILE_PATH, { encoding: 'utf8' })).to.equal(PDF_CONTENT);
        });
        it('stores the MIME type', () => {
          expect(mime.getType(EXPECTED_PDF_SNAPSHOT_FILE_PATH)).to.equal(PDF_MIME_TYPE);
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

      after(() => subject.removeAll());

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

      it('returns the content', () => {
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

      before(async function () {
        this.timeout(5000);

        const { id: id1 } = await subject.save(new Snapshot({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: CONTENT,
          fetchDate: FETCH_DATE,
          documentId: DOCUMENT_ID,
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

      after(() => subject.removeAll());

      it('returns all records', () => {
        expect(records.length).to.equal(3);
      });

      it('returns Snapshot objects', () => {
        for (const record of records) {
          expect(record).to.be.an.instanceof(Snapshot);
        }
      });

      it('returns records in ascending order', () => {
        expect(records.map(record => record.fetchDate)).to.deep.equal([ FETCH_DATE_EARLIER, FETCH_DATE, FETCH_DATE_LATER ]);
      });
    });

    describe('#count', () => {
      let count;

      before(async function () {
        this.timeout(5000);

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

      after(() => subject.removeAll());

      it('returns the proper count', () => {
        expect(count).to.equal(3);
      });
    });

    describe('#findLatest', () => {
      context('when there are records for the given service', () => {
        let lastSnapshotId;
        let latestRecord;

        context('with HTML document', () => {
          const UPDATED_FILE_CONTENT = `${CONTENT} (with additional content to trigger a record)`;

          before(async () => {
            await subject.save(new Snapshot({
              serviceId: SERVICE_PROVIDER_ID,
              termsType: TERMS_TYPE,
              content: CONTENT,
              mimeType: HTML_MIME_TYPE,
              fetchDate: FETCH_DATE_EARLIER,
            }));

            ({ id: lastSnapshotId } = await subject.save(new Snapshot({
              serviceId: SERVICE_PROVIDER_ID,
              termsType: TERMS_TYPE,
              content: UPDATED_FILE_CONTENT,
              mimeType: HTML_MIME_TYPE,
              fetchDate: FETCH_DATE,
            })));

            latestRecord = await subject.findLatest(SERVICE_PROVIDER_ID, TERMS_TYPE);
          });

          after(() => subject.removeAll());

          it('returns a Snapshot object', () => {
            expect(latestRecord).to.be.an.instanceof(Snapshot);
          });

          it('returns the latest record id', () => {
            expect(latestRecord.id).to.include(lastSnapshotId);
          });

          it('returns the latest record content', () => {
            expect(latestRecord.content.toString('utf8')).to.equal(UPDATED_FILE_CONTENT);
          });

          it('returns the latest record mime type', () => {
            expect(latestRecord.mimeType).to.equal(HTML_MIME_TYPE);
          });
        });

        context('with PDF document', () => {
          before(async () => {
            ({ id: lastSnapshotId } = await subject.save(new Snapshot({
              serviceId: SERVICE_PROVIDER_ID,
              termsType: TERMS_TYPE,
              content: PDF_CONTENT,
              mimeType: PDF_MIME_TYPE,
              fetchDate: FETCH_DATE,
            })));

            latestRecord = await subject.findLatest(SERVICE_PROVIDER_ID, TERMS_TYPE);
          });

          after(() => subject.removeAll());

          it('returns the latest record id', () => {
            expect(latestRecord.id).to.include(lastSnapshotId);
          });

          it('returns the latest record content', () => {
            expect(latestRecord.content.toString('utf8')).to.equal(PDF_CONTENT);
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

        it('returns null', () => {
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

      after(() => subject.removeAll());

      it('iterates through all records', () => {
        expect(ids).to.have.members(expectedIds);
      });

      it('iterates in ascending order', () => {
        expect(fetchDates).to.deep.equal([ FETCH_DATE_EARLIER, FETCH_DATE, FETCH_DATE_LATER ]);
      });
    });
  });

  context('backwards compatibility with deprecated commit messages', () => {
    const expectedIds = [];
    const expectedDates = [];

    let subject;

    const commits = {
      deprecatedFirstRecord: {
        path: 'service/terms-deprecated.md',
        content: 'content',
        message: 'Start tracking Service Terms\n\nThis version was recorded after extracting from snapshot https://github.com/ambanum/OpenTermsArchive-snapshots/commit/513fadb2ae415c87747047e33287805d59e2dd55',
        date: new Date('2023-02-28T01:00:00.000Z'),
      },
      deprecatedRefilter: {
        path: 'service/terms-deprecated.md',
        content: 'content refiltered',
        message: 'Refilter Service Terms\n\nThis version was recorded after extracting from snapshot https://github.com/ambanum/OpenTermsArchive-snapshots/commit/513fadb2ae415c87747047e33287805d59e2dd55',
        date: new Date('2023-02-28T02:00:00.000Z'),
      },
      deprecatedUpdate: {
        path: 'service/terms-deprecated.md',
        content: 'content updated',
        message: 'Update Service Terms\n\nThis version was recorded after extracting from snapshot https://github.com/ambanum/OpenTermsArchive-snapshots/commit/513fadb2ae415c87747047e33287805d59e2dd55',
        date: new Date('2023-02-28T03:00:00.000Z'),
      },
      currentFirstRecord: {
        path: 'service/terms-current.md',
        content: 'content',
        message: 'First record of Service Terms\n\nThis version was recorded after extracting from snapshot https://github.com/ambanum/OpenTermsArchive-snapshots/commit/513fadb2ae415c87747047e33287805d59e2dd55',
        date: new Date('2023-02-28T04:00:00.000Z'),
      },
      currentExtractOnly: {
        path: 'service/terms-current.md',
        content: 'content extract only',
        message: 'Apply technical or declaration upgrade on Service Terms\n\nThis version was recorded after extracting from snapshot https://github.com/ambanum/OpenTermsArchive-snapshots/commit/513fadb2ae415c87747047e33287805d59e2dd55',
        date: new Date('2023-02-28T05:00:00.000Z'),
      },
      currentUpdate: {
        path: 'service/terms-current.md',
        content: 'content updated',
        message: 'Record new changes of Service Terms\n\nThis version was recorded after extracting from snapshot https://github.com/ambanum/OpenTermsArchive-snapshots/commit/513fadb2ae415c87747047e33287805d59e2dd55',
        date: new Date('2023-02-28T06:00:00.000Z'),
      },
    };

    before(async function () {
      this.timeout(5000);
      git = new Git({
        path: RECORDER_PATH,
        author: {
          name: config.get('recorder.versions.storage.git.author.name'),
          email: config.get('recorder.versions.storage.git.author.email'),
        },
      });

      await git.initialize();
      subject = new GitRepository({
        ...config.get('recorder.versions.storage.git'),
        path: RECORDER_PATH,
      });

      await subject.initialize();

      /* eslint-disable no-await-in-loop */
      for (const commit of Object.values(commits)) {
        const { path: relativeFilePath, date, content, message } = commit;
        const filePath = path.join(RECORDER_PATH, relativeFilePath);

        await GitRepository.writeFile({ filePath, content });

        await git.add(filePath);
        const sha = await git.commit({ filePath, message, date });

        commit.id = sha;
        expectedIds.push(sha);
        expectedDates.push(date);
      }
      /* eslint-enable no-await-in-loop */
    });

    after(() => subject.removeAll());

    describe('Records attributes', () => {
      describe('#isExtractOnly', () => {
        context('records with deprecated message', () => {
          it('returns the proper value', async () => {
            expect((await subject.findById(commits.deprecatedRefilter.id)).isExtractOnly).to.be.true;
          });

          it('returns the proper value', async () => {
            expect((await subject.findById(commits.deprecatedFirstRecord.id)).isExtractOnly).to.be.false;
          });
        });

        context('record with current message', () => {
          it('returns the proper value', async () => {
            expect((await subject.findById(commits.currentExtractOnly.id)).isExtractOnly).to.be.true;
          });

          it('returns the proper value', async () => {
            expect((await subject.findById(commits.currentFirstRecord.id)).isExtractOnly).to.be.false;
          });
        });
      });

      describe('#isFirstRecord', () => {
        context('records with deprecated message', () => {
          it('returns the proper value', async () => {
            expect((await subject.findById(commits.deprecatedFirstRecord.id)).isFirstRecord).to.be.true;
          });

          it('returns the proper value', async () => {
            expect((await subject.findById(commits.deprecatedRefilter.id)).isFirstRecord).to.be.false;
          });
        });

        context('record with current message', () => {
          it('returns the proper value', async () => {
            expect((await subject.findById(commits.currentFirstRecord.id)).isFirstRecord).to.be.true;
          });

          it('returns the proper value', async () => {
            expect((await subject.findById(commits.currentExtractOnly.id)).isFirstRecord).to.be.false;
          });
        });
      });
    });

    describe('#findAll', () => {
      let records;

      before(async function () {
        this.timeout(5000);

        (records = await subject.findAll());
      });

      it('returns all records', () => {
        expect(records.map(record => record.id)).to.have.members(expectedIds);
      });

      it('returns Version objects', () => {
        for (const record of records) {
          expect(record).to.be.an.instanceof(Version);
        }
      });

      it('returns records in ascending order', () => {
        expect(records.map(record => record.fetchDate)).to.deep.equal(expectedDates);
      });
    });

    describe('#count', () => {
      let count;

      before(async () => {
        (count = await subject.count());
      });

      it('returns the proper count', () => {
        expect(count).to.equal(expectedIds.length);
      });
    });

    describe('#iterate', () => {
      const ids = [];
      const fetchDates = [];

      before(async () => {
        for await (const record of subject.iterate()) {
          ids.push(record.id);
          fetchDates.push(record.fetchDate);
        }
      });

      it('iterates through all records', () => {
        expect(ids).to.have.members(expectedIds);
      });

      it('iterates in ascending order', () => {
        expect(fetchDates).to.deep.equal(expectedDates);
      });
    });
  });
});
