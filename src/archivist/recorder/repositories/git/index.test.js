import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import chai from 'chai';
import config from 'config';
import mime from 'mime';

import Record from '../../record.js';

import { TERMS_TYPE_AND_DOCUMENT_ID_SEPARATOR, SNAPSHOT_ID_MARKER, COMMIT_MESSAGE_PREFIX } from './dataMapper.js';
import Git from './git.js';

import GitRepository from './index.js';

const { expect } = chai;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECORDER_PATH = path.resolve(__dirname, '../../../../..', config.get('recorder.versions.storage.git.path'));

const SERVICE_PROVIDER_ID = 'test_service';
const TERMS_TYPE = 'Terms of Service';
const DOCUMENT_ID = 'community-standards-hate-speech';
const CONTENT = 'ToS fixture data with UTF-8 çhãràčtęrs';
const EXPECTED_FILE_PATH = `${RECORDER_PATH}/${SERVICE_PROVIDER_ID}/${TERMS_TYPE}.html`;
const EXPECTED_FILE_PATH_WITH_DOCUMENT_ID = `${RECORDER_PATH}/${SERVICE_PROVIDER_ID}/${TERMS_TYPE}${TERMS_TYPE_AND_DOCUMENT_ID_SEPARATOR}${DOCUMENT_ID}.html`;
const EXPECTED_PDF_FILE_PATH = EXPECTED_FILE_PATH.replace('html', 'pdf');
const FETCH_DATE = new Date('2000-01-01T12:00:00.000Z');
const FETCH_DATE_LATER = new Date('2000-01-02T12:00:00.000Z');
const FETCH_DATE_EARLIER = new Date('2000-01-01T06:00:00.000Z');
const SNAPSHOT_ID = '513fadb2ae415c87747047e33287805d59e2dd55';
const MIME_TYPE = 'text/html';
const PDF_CONTENT = fs.readFileSync(path.resolve(__dirname, '../../../../../test/fixtures/terms.pdf'), { encoding: 'utf8' });
const PDF_MIME_TYPE = 'application/pdf';

let git;

describe('GitRepository', () => {
  let subject;

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

        ({ id, isFirstRecord } = await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          documentId: DOCUMENT_ID,
          content: CONTENT,
          fetchDate: FETCH_DATE,
          snapshotIds: [SNAPSHOT_ID],
          mimeType: MIME_TYPE,
        })));

        numberOfRecordsAfter = (await git.log()).length;

        ([commit] = await git.log());
      });

      after(async () => subject.removeAll());

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
        expect(commit.message).to.include(COMMIT_MESSAGE_PREFIX.startTracking);
      });

      it('stores the proper content', () => {
        expect(fs.readFileSync(EXPECTED_FILE_PATH_WITH_DOCUMENT_ID, { encoding: 'utf8' })).to.equal(CONTENT);
      });

      context('when provided', () => {
        it('stores the fetch date', () => {
          expect(new Date(commit.date).getTime()).to.equal(FETCH_DATE.getTime());
        });

        it('stores the MIME type', () => {
          expect(mime.getType(EXPECTED_FILE_PATH_WITH_DOCUMENT_ID)).to.equal(MIME_TYPE);
        });

        it('stores the snapshot ID', () => {
          expect(commit.body).to.include(SNAPSHOT_ID);
        });

        it('stores the document ID', () => {
          expect(commit.body).to.include(DOCUMENT_ID);
        });
      });
    });

    context('when it is not the first record', () => {
      const UPDATED_CONTENT = `${CONTENT} updated`;

      before(async () => {
        await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: CONTENT,
          mimeType: MIME_TYPE,
          fetchDate: FETCH_DATE,
        }));

        numberOfRecordsBefore = (await git.log()).length;

        ({ id, isFirstRecord } = await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: UPDATED_CONTENT,
          fetchDate: FETCH_DATE,
          snapshotIds: [SNAPSHOT_ID],
          mimeType: MIME_TYPE,
        })));

        numberOfRecordsAfter = (await git.log()).length;

        ([commit] = await git.log());
      });

      after(async () => subject.removeAll());

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
        await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: CONTENT,
          mimeType: MIME_TYPE,
          fetchDate: FETCH_DATE,
        }));

        numberOfRecordsBefore = (await git.log()).length;

        ({ id, isFirstRecord } = await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: CONTENT,
          mimeType: MIME_TYPE,
          fetchDate: FETCH_DATE,
        })));

        numberOfRecordsAfter = (await git.log()).length;
      });

      after(async () => subject.removeAll());

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
        await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: CONTENT,
          mimeType: MIME_TYPE,
          fetchDate: FETCH_DATE_EARLIER,
        })); // An extracted only version cannot be the first record

        numberOfRecordsBefore = (await git.log()).length;

        ({ id, isFirstRecord } = await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: EXTRACTED_ONLY_CONTENT,
          fetchDate: FETCH_DATE,
          isExtractOnly: true,
          snapshotIds: [SNAPSHOT_ID],
          mimeType: MIME_TYPE,
        })));

        numberOfRecordsAfter = (await git.log()).length;

        ([commit] = await git.log());
      });

      after(async () => subject.removeAll());

      it('saves the record', () => {
        expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
      });

      it('returns the record id', () => {
        expect(commit.hash).to.include(id);
      });

      it('stores information that it is an extracted only version', () => {
        expect(commit.message).to.include(COMMIT_MESSAGE_PREFIX.extractOnly);
      });
    });

    context('with PDF document', () => {
      before(async () => {
        numberOfRecordsBefore = (await git.log()).length;

        ({ id, isFirstRecord } = await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          content: PDF_CONTENT,
          fetchDate: FETCH_DATE,
          snapshotIds: [SNAPSHOT_ID],
          mimeType: PDF_MIME_TYPE,
        })));

        numberOfRecordsAfter = (await git.log()).length;

        ([commit] = await git.log());
      });

      after(async () => subject.removeAll());

      it('saves the record', () => {
        expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
      });

      it('returns the record id', () => {
        expect(commit.hash).to.include(id);
      });

      it('stores the proper content', () => {
        expect(fs.readFileSync(EXPECTED_PDF_FILE_PATH, { encoding: 'utf8' })).to.equal(PDF_CONTENT);
      });

      it('stores the MIME type', () => {
        expect(mime.getType(EXPECTED_PDF_FILE_PATH)).to.equal(PDF_MIME_TYPE);
      });
    });

    context('when there is no snapshots IDs specified', () => {
      before(async () => {
        ({ id, isFirstRecord } = await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          documentId: DOCUMENT_ID,
          content: CONTENT,
          fetchDate: FETCH_DATE,
          mimeType: MIME_TYPE,
        })));

        ([commit] = await git.log());
      });

      after(async () => subject.removeAll());

      it('does not store snapshots IDs', () => {
        expect(commit.body).to.be.equal(`Document ID ${DOCUMENT_ID}\n`);
      });

      it('stores the service ID', () => {
        expect(commit.message).to.include(SERVICE_PROVIDER_ID);
      });

      it('stores the terms type', () => {
        expect(commit.message).to.include(TERMS_TYPE);
      });

      it('stores the document ID', () => {
        expect(commit.body).to.include(DOCUMENT_ID);
      });
    });

    context('when one snapshot ID is specified', () => {
      const SNAPSHOT_ID = 'c01533c0e546ef430eea84d23c1b18a2b8420dfb';
      const snapshotIds = [SNAPSHOT_ID];

      before(async () => {
        ({ id, isFirstRecord } = await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          documentId: DOCUMENT_ID,
          content: CONTENT,
          fetchDate: FETCH_DATE,
          mimeType: MIME_TYPE,
          snapshotIds,
        })));

        ([commit] = await git.log());
      });

      after(async () => subject.removeAll());

      it('stores snapshot ID', () => {
        expect(commit.body).to.include(config.get('recorder.versions.storage.git.snapshotIdentiferTemplate').replace(SNAPSHOT_ID_MARKER, SNAPSHOT_ID));
      });

      it('stores the service ID', () => {
        expect(commit.message).to.include(SERVICE_PROVIDER_ID);
      });

      it('stores the terms type', () => {
        expect(commit.message).to.include(TERMS_TYPE);
      });

      it('stores the document ID', () => {
        expect(commit.body).to.include(DOCUMENT_ID);
      });
    });

    context('when there are many snapshots IDs specified', () => {
      const SNAPSHOT_ID_1 = 'c01533c0e546ef430eea84d23c1b18a2b8420dfb';
      const SNAPSHOT_ID_2 = '0fd16cca9e1a86a2267bd587107c485f06099d7d';
      const snapshotIds = [ SNAPSHOT_ID_1, SNAPSHOT_ID_2 ];

      before(async () => {
        ({ id, isFirstRecord } = await subject.save(new Record({
          serviceId: SERVICE_PROVIDER_ID,
          termsType: TERMS_TYPE,
          documentId: DOCUMENT_ID,
          content: CONTENT,
          fetchDate: FETCH_DATE,
          mimeType: MIME_TYPE,
          snapshotIds,
        })));

        ([commit] = await git.log());
      });

      after(async () => subject.removeAll());

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

      it('stores the document ID', () => {
        expect(commit.body).to.include(DOCUMENT_ID);
      });
    });
  });

  describe('#findById', () => {
    let record;
    let id;

    before(async () => {
      ({ id } = await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        termsType: TERMS_TYPE,
        documentId: DOCUMENT_ID,
        content: CONTENT,
        fetchDate: FETCH_DATE,
        snapshotIds: [SNAPSHOT_ID],
        mimeType: MIME_TYPE,
      })));

      (record = await subject.findById(id));
    });

    after(async () => subject.removeAll());

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
      expect(record.mimeType).to.equal(MIME_TYPE);
    });

    it('returns the snapshot ID', () => {
      expect(record.snapshotIds).to.deep.equal([SNAPSHOT_ID]);
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

      const { id: id1 } = await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        termsType: TERMS_TYPE,
        content: CONTENT,
        fetchDate: FETCH_DATE,
        snapshotIds: [SNAPSHOT_ID],
        mimeType: MIME_TYPE,
      }));

      expectedIds.push(id1);

      const { id: id2 } = await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        termsType: TERMS_TYPE,
        content: `${CONTENT} - updated`,
        fetchDate: FETCH_DATE_LATER,
        snapshotIds: [SNAPSHOT_ID],
        mimeType: MIME_TYPE,
      }));

      expectedIds.push(id2);

      const { id: id3 } = await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        termsType: TERMS_TYPE,
        content: `${CONTENT} - updated 2`,
        isExtractOnly: true,
        fetchDate: FETCH_DATE_EARLIER,
        snapshotIds: [SNAPSHOT_ID],
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

    before(async function () {
      this.timeout(5000);

      await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        termsType: TERMS_TYPE,
        content: CONTENT,
        fetchDate: FETCH_DATE,
        snapshotIds: [SNAPSHOT_ID],
        mimeType: MIME_TYPE,
      }));
      await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        termsType: TERMS_TYPE,
        content: `${CONTENT} - updated`,
        fetchDate: FETCH_DATE_LATER,
        snapshotIds: [SNAPSHOT_ID],
        mimeType: MIME_TYPE,
      }));
      await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        termsType: TERMS_TYPE,
        content: `${CONTENT} - updated 2`,
        isExtractOnly: true,
        fetchDate: FETCH_DATE_EARLIER,
        snapshotIds: [SNAPSHOT_ID],
        mimeType: MIME_TYPE,
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
        const UPDATED_FILE_CONTENT = `${CONTENT} (with additional content to trigger a record)`;

        before(async () => {
          await subject.save(new Record({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: CONTENT,
            mimeType: MIME_TYPE,
            fetchDate: FETCH_DATE_EARLIER,
          }));

          ({ id: lastSnapshotId } = await subject.save(new Record({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: UPDATED_FILE_CONTENT,
            mimeType: MIME_TYPE,
            fetchDate: FETCH_DATE,
          })));

          latestRecord = await subject.findLatest(SERVICE_PROVIDER_ID, TERMS_TYPE);
        });

        after(async () => subject.removeAll());

        it('returns the latest record id', () => {
          expect(latestRecord.id).to.include(lastSnapshotId);
        });

        it('returns the latest record content', async () => {
          expect(latestRecord.content.toString('utf8')).to.equal(UPDATED_FILE_CONTENT);
        });

        it('returns the latest record mime type', () => {
          expect(latestRecord.mimeType).to.equal(MIME_TYPE);
        });
      });

      context('with PDF document', () => {
        before(async () => {
          ({ id: lastSnapshotId } = await subject.save(new Record({
            serviceId: SERVICE_PROVIDER_ID,
            termsType: TERMS_TYPE,
            content: PDF_CONTENT,
            mimeType: PDF_MIME_TYPE,
            fetchDate: FETCH_DATE,
          })));

          latestRecord = await subject.findLatest(SERVICE_PROVIDER_ID, TERMS_TYPE);
        });

        after(async () => subject.removeAll());

        it('returns the latest record id', () => {
          expect(latestRecord.id).to.include(lastSnapshotId);
        });

        it('returns the latest record content', async () => {
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
      const { id: id1 } = await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        termsType: TERMS_TYPE,
        content: CONTENT,
        fetchDate: FETCH_DATE,
        snapshotIds: [SNAPSHOT_ID],
        mimeType: MIME_TYPE,
      }));

      expectedIds.push(id1);

      const { id: id2 } = await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        termsType: TERMS_TYPE,
        content: `${CONTENT} - updated`,
        fetchDate: FETCH_DATE_LATER,
        snapshotIds: [SNAPSHOT_ID],
        mimeType: MIME_TYPE,
      }));

      expectedIds.push(id2);

      const { id: id3 } = await subject.save(new Record({
        serviceId: SERVICE_PROVIDER_ID,
        termsType: TERMS_TYPE,
        content: `${CONTENT} - updated 2`,
        isExtractOnly: true,
        fetchDate: FETCH_DATE_EARLIER,
        snapshotIds: [SNAPSHOT_ID],
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

  context('backwards compatibility with deprecated commit messages', () => {
    const expectedIds = [];
    const expectedDates = [];

    let subject;

    const commits = {
      deprecatedFirstRecord: {
        path: 'service/terms-deprecated.md',
        content: 'content',
        message: 'Start tracking Service Terms',
        date: new Date('2023-02-28T01:00:00.000Z'),
      },
      deprecatedRefilter: {
        path: 'service/terms-deprecated.md',
        content: 'content refiltered',
        message: 'Refilter Service Terms',
        date: new Date('2023-02-28T02:00:00.000Z'),
      },
      deprecatedUpdate: {
        path: 'service/terms-deprecated.md',
        content: 'content updated',
        message: 'Update Service Terms',
        date: new Date('2023-02-28T03:00:00.000Z'),
      },
      currentFirstRecord: {
        path: 'service/terms-current.md',
        content: 'content',
        message: 'First record of Service Terms',
        date: new Date('2023-02-28T04:00:00.000Z'),
      },
      currentExtractOnly: {
        path: 'service/terms-current.md',
        content: 'content extract only',
        message: 'Apply technical or declaration upgrade on Service Terms',
        date: new Date('2023-02-28T05:00:00.000Z'),
      },
      currentUpdate: {
        path: 'service/terms-current.md',
        content: 'content updated',
        message: 'Record new changes of Service Terms',
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

        const sha = await subject.commit({ filePath, message, date });

        commit.id = sha;
        expectedIds.push(sha);
        expectedDates.push(date);
      }
      /* eslint-enable no-await-in-loop */
    });

    after(async () => subject.removeAll());

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

      it('returns Record objects', () => {
        for (const record of records) {
          expect(record).to.be.an.instanceof(Record);
        }
      });

      it('returns records in ascending order', async () => {
        expect(records.map(record => record.fetchDate)).to.deep.equal(expectedDates);
      });
    });

    describe('#count', () => {
      let count;

      before(async () => {
        (count = await subject.count());
      });

      it('returns the proper count', async () => {
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

      it('iterates through all records', async () => {
        expect(ids).to.have.members(expectedIds);
      });

      it('iterates in ascending order', async () => {
        expect(fetchDates).to.deep.equal(expectedDates);
      });
    });
  });
});
