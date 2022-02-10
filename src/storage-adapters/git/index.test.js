import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import chai from 'chai';
import config from 'config';
import mime from 'mime';

import Git from './git.js';

import GitAdapter from './index.js';

const { expect } = chai;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECORDER_PATH = path.resolve(__dirname, '../../../', config.get('recorder.snapshots.storage.git.path'));

const SERVICE_PROVIDER_ID = 'test_service';
const DOCUMENT_TYPE = 'Terms of Service';
const CONTENT = 'ToS fixture data with UTF-8 çhãràčtęrs';
const EXPECTED_FILE_PATH = `${RECORDER_PATH}/${SERVICE_PROVIDER_ID}/${DOCUMENT_TYPE}.html`;
const EXPECTED_PDF_FILE_PATH = EXPECTED_FILE_PATH.replace('html', 'pdf');
const FETCH_DATE = new Date('2000-01-01T12:00:00.000Z');
const SNAPSHOT_ID = 'snapshot_id';
const MIME_TYPE = 'text/html';
const PDF_CONTENT = fs.readFileSync(path.resolve(__dirname, '../../../test/fixtures/terms.pdf'), { encoding: 'utf8' });
const PDF_MIME_TYPE = 'application/pdf';

let git;

describe('GitAdapter', () => {
  let subject;

  before(async () => {
    git = new Git({
      path: RECORDER_PATH,
      author: {
        name: config.get('recorder.snapshots.storage.git.author.name'),
        email: config.get('recorder.snapshots.storage.git.author.email'),
      },
    });

    await git.initialize();

    subject = new GitAdapter({
      ...config.get('recorder.snapshots.storage.git'),
      path: RECORDER_PATH,
      fileExtension: 'html',
    });

    return subject.initialize();
  });

  describe('#_save', () => {
    context('when service directory already exists', () => {
      before(async () => subject._save({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: DOCUMENT_TYPE,
        content: CONTENT,
      }));

      after(async () => subject._removeAllRecords());

      it('creates a file for the given service', () => {
        expect(fs.readFileSync(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(CONTENT);
      });

      context('with provided extension', () => {
        let savedFilePath;

        before(async () => {
          savedFilePath = await subject._save({
            serviceId: SERVICE_PROVIDER_ID,
            documentType: DOCUMENT_TYPE,
            content: CONTENT,
            fileExtension: 'pdf',
          });
        });

        after(async () => subject._removeAllRecords());

        it('creates a file for the given service with the given extension', () => {
          expect(savedFilePath).to.equal(EXPECTED_PDF_FILE_PATH);
        });
      });
    });

    context('when service directory does not already exist', () => {
      const NEW_SERVICE_ID = 'test_not_existing_service';
      const NEW_SERVICE_EXPECTED_FILE_PATH = `${RECORDER_PATH}/${NEW_SERVICE_ID}/${DOCUMENT_TYPE}.html`;

      after(async () => subject._removeAllRecords());

      it('creates a directory and file for the given service', async () => {
        await subject._save({ serviceId: NEW_SERVICE_ID, documentType: DOCUMENT_TYPE, content: CONTENT });

        expect(fs.readFileSync(NEW_SERVICE_EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(CONTENT);
      });
    });
  });

  describe('#_commit', () => {
    const COMMIT_MESSAGE = 'Message to check if the commit message is properly saved';
    let id;
    let commit;

    before(async () => {
      await subject._save({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: DOCUMENT_TYPE,
        content: CONTENT,
      });

      id = await subject._commit(EXPECTED_FILE_PATH, COMMIT_MESSAGE);

      ([commit] = await git.log());
    });

    after(async () => subject._removeAllRecords());

    it('returns the id of the commit', () => {
      expect(commit.hash).to.include(id);
    });

    it('properly saves the commit message', () => {
      expect(commit.message).to.equal(COMMIT_MESSAGE);
    });
  });

  describe('#_getPathFor', () => {
    context('without provided extension', () => {
      it('returns the file path with default extension for the given service provider’s document type', () => {
        expect(subject._getPathFor(SERVICE_PROVIDER_ID, DOCUMENT_TYPE)).to.equal(EXPECTED_FILE_PATH);
      });
    });

    context('with provided extension', () => {
      it('returns the file path with given extension for the given service provider’s document type', () => {
        expect(subject._getPathFor(SERVICE_PROVIDER_ID, DOCUMENT_TYPE, 'pdf')).to.equal(EXPECTED_PDF_FILE_PATH);
      });
    });
  });

  describe('#_isTracked', () => {
    after(async () => subject._removeAllRecords());

    context('when the file does not exists', () => {
      it('returns false', async () => {
        expect(await subject._isTracked(SERVICE_PROVIDER_ID, DOCUMENT_TYPE)).to.be.false;
      });
    });

    context('when the file already exists', () => {
      before(async () => {
        await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: CONTENT,
        });
      });

      it('returns true', async () => {
        expect(await subject._isTracked(SERVICE_PROVIDER_ID, DOCUMENT_TYPE)).to.be.true;
      });
    });
  });

  describe('#record', () => {
    let id;
    let commit;
    let isFirstRecord;
    let numberOfRecordsBefore;
    let numberOfRecordsAfter;

    context('when it is the first record', () => {
      before(async () => {
        numberOfRecordsBefore = (await git.log()).length;

        ({ id, isFirstRecord } = await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: CONTENT,
          fetchDate: FETCH_DATE,
          snapshotId: SNAPSHOT_ID,
          mimeType: MIME_TYPE,
        }));

        numberOfRecordsAfter = (await git.log()).length;

        ([commit] = await git.log());
      });

      after(async () => subject._removeAllRecords());

      it('saves the record', () => {
        expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
      });

      it('returns the record id', () => {
        expect(commit.hash).to.include(id);
      });

      it('returns a boolean to know if it is the first record', () => {
        expect(isFirstRecord).to.be.true;
      });

      it('stores the service id', () => {
        expect(commit.message).to.include(SERVICE_PROVIDER_ID);
      });

      it('stores the document type', () => {
        expect(commit.message).to.include(DOCUMENT_TYPE);
      });

      it('stores information that it is the first record for this specific document', () => {
        expect(commit.message).to.include('Start tracking');
      });

      it('stores the proper content', () => {
        expect(fs.readFileSync(EXPECTED_FILE_PATH, { encoding: 'utf8' })).to.equal(CONTENT);
      });

      context('when provided', () => {
        it('stores the fetch date', () => {
          expect(new Date(commit.date).getTime()).to.equal(FETCH_DATE.getTime());
        });

        it('stores the mime type', () => {
          expect(mime.getType(EXPECTED_FILE_PATH)).to.equal(MIME_TYPE);
        });

        it('stores the snapshot ID', () => {
          expect(commit.body).to.include(SNAPSHOT_ID);
        });
      });
    });

    context('when it is not the first record', () => {
      const UPDATED_CONTENT = `${CONTENT} updated`;

      before(async () => {
        await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: CONTENT,
        });

        numberOfRecordsBefore = (await git.log()).length;

        ({ id, isFirstRecord } = await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: UPDATED_CONTENT,
          fetchDate: FETCH_DATE,
          snapshotId: SNAPSHOT_ID,
          mimeType: MIME_TYPE,
        }));

        numberOfRecordsAfter = (await git.log()).length;

        ([commit] = await git.log());
      });

      after(async () => subject._removeAllRecords());

      it('saves the record', () => {
        expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
      });

      it('returns the record id', () => {
        expect(commit.hash).to.include(id);
      });

      it('returns a boolean to know if it is the first record', () => {
        expect(isFirstRecord).to.be.false;
      });
    });

    context('when the content has not changed', () => {
      before(async () => {
        await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: CONTENT,
        });

        numberOfRecordsBefore = (await git.log()).length;

        ({ id, isFirstRecord } = await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: CONTENT,
        }));

        numberOfRecordsAfter = (await git.log()).length;
      });

      after(async () => subject._removeAllRecords());

      it('does not save the record', () => {
        expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore);
      });

      it('returns no id', () => {
        expect(id).to.equal(undefined);
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

        numberOfRecordsBefore = (await git.log()).length;

        ({ id, isFirstRecord } = await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: REFILTERED_CONTENT,
          fetchDate: FETCH_DATE,
          isRefilter: true,
          snapshotId: SNAPSHOT_ID,
          mimeType: MIME_TYPE,
        }));

        numberOfRecordsAfter = (await git.log()).length;

        ([commit] = await git.log());
      });

      after(async () => subject._removeAllRecords());

      it('saves the record', () => {
        expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
      });

      it('returns the record id', () => {
        expect(commit.hash).to.include(id);
      });

      it('stores information that it is a refilter of this specific document', () => {
        expect(commit.message).to.include('Refilter');
      });
    });

    context('with PDF document', () => {
      before(async () => {
        numberOfRecordsBefore = (await git.log()).length;

        ({ id, isFirstRecord } = await subject.record({
          serviceId: SERVICE_PROVIDER_ID,
          documentType: DOCUMENT_TYPE,
          content: PDF_CONTENT,
          fetchDate: FETCH_DATE,
          snapshotId: SNAPSHOT_ID,
          mimeType: PDF_MIME_TYPE,
        }));

        numberOfRecordsAfter = (await git.log()).length;

        ([commit] = await git.log());
      });

      after(async () => subject._removeAllRecords());

      it('saves the record', () => {
        expect(numberOfRecordsAfter).to.equal(numberOfRecordsBefore + 1);
      });

      it('returns the record id', () => {
        expect(commit.hash).to.include(id);
      });

      it('stores the proper content', () => {
        expect(fs.readFileSync(EXPECTED_PDF_FILE_PATH, { encoding: 'utf8' })).to.equal(PDF_CONTENT);
      });

      it('stores the mime type', () => {
        expect(mime.getType(EXPECTED_PDF_FILE_PATH)).to.equal(PDF_MIME_TYPE);
      });
    });
  });

  describe('#getLatestRecord', () => {
    context('when there are records for the given service', () => {
      let lastSnapshotId;
      let latestRecord;

      context('with HTML document', () => {
        const UPDATED_FILE_CONTENT = `${CONTENT} (with additional content to trigger a record)`;

        before(async () => {
          await subject.record({
            serviceId: SERVICE_PROVIDER_ID,
            documentType: DOCUMENT_TYPE,
            content: CONTENT,
          });

          ({ id: lastSnapshotId } = await subject.record({
            serviceId: SERVICE_PROVIDER_ID,
            documentType: DOCUMENT_TYPE,
            content: UPDATED_FILE_CONTENT,
          }));

          latestRecord = await subject.getLatestRecord(SERVICE_PROVIDER_ID, DOCUMENT_TYPE);
        });

        after(async () => subject._removeAllRecords());

        it('returns the latest record id', () => {
          expect(latestRecord.id).to.include(lastSnapshotId);
        });

        it('returns the latest record content', () => {
          expect(latestRecord.content.toString('utf8')).to.equal(UPDATED_FILE_CONTENT);
        });

        it('returns the latest record mime type', () => {
          expect(latestRecord.mimeType).to.equal(MIME_TYPE);
        });
      });

      context('with PDF document', () => {
        before(async () => {
          ({ id: lastSnapshotId } = await subject.record({
            serviceId: SERVICE_PROVIDER_ID,
            documentType: DOCUMENT_TYPE,
            content: PDF_CONTENT,
            mimeType: PDF_MIME_TYPE,
          }));

          latestRecord = await subject.getLatestRecord(SERVICE_PROVIDER_ID, DOCUMENT_TYPE);
        });

        after(async () => subject._removeAllRecords());

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
        latestRecord = await subject.getLatestRecord(SERVICE_PROVIDER_ID, DOCUMENT_TYPE);
      });

      it('returns no id', () => {
        expect(latestRecord.id).to.not.be.ok;
      });

      it('returns no content', () => {
        expect(latestRecord.content).to.not.be.ok;
      });

      it('returns no mime type', () => {
        expect(latestRecord.mimeType).to.not.be.ok;
      });
    });
  });

  describe('#iterate', () => {
    before(async () => {
      await subject.record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: DOCUMENT_TYPE,
        content: CONTENT,
        fetchDate: FETCH_DATE,
        snapshotId: SNAPSHOT_ID,
        mimeType: MIME_TYPE,
      });

      await subject.record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: DOCUMENT_TYPE,
        content: `${CONTENT} - updated`,
        fetchDate: FETCH_DATE,
        snapshotId: SNAPSHOT_ID,
        mimeType: MIME_TYPE,
      });

      await subject.record({
        serviceId: SERVICE_PROVIDER_ID,
        documentType: DOCUMENT_TYPE,
        content: `${CONTENT} - updated 2`,
        fetchDate: FETCH_DATE,
        snapshotId: SNAPSHOT_ID,
        mimeType: MIME_TYPE,
      });
    });

    after(async () => subject._removeAllRecords());

    it('iterates through all records', async () => {
      const result = [];

      for await (const record of subject.iterate()) {
        result.push(record.content);
      }

      expect(result).to.deep.equal([ `${CONTENT} - updated 2`, `${CONTENT} - updated`, CONTENT ]);
    });
  });
});
