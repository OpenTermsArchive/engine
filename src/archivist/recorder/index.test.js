import path from 'path';
import { fileURLToPath } from 'url';

import chai from 'chai';
import config from 'config';

import GitAdapter from '../../storage-adapters/git/index.js';
import MongoAdapter from '../../storage-adapters/mongo/index.js';

import Recorder from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SNAPSHOTS_PATH = path.resolve(__dirname, '../../../', config.get('recorder.snapshots.storage.git.path'));
export const VERSIONS_PATH = path.resolve(__dirname, '../../../', config.get('recorder.versions.storage.git.path'));

const { expect } = chai;

const MIME_TYPE = 'text/html';
const FETCH_DATE = new Date('2000-01-01T12:00:00.000Z');
const FETCH_DATE_LATER = new Date('2000-01-02T12:00:00.000Z');

describe('Recorder', () => {
  const SERVICE_ID = 'test_service';
  const TYPE = 'Terms of Service';

  const adaptersTypes = {
    git: {
      snapshots: new GitAdapter({
        ...config.get('recorder.snapshots.storage.git'),
        path: SNAPSHOTS_PATH,
        fileExtension: 'html',
      }),
      versions: new GitAdapter({
        ...config.get('recorder.versions.storage.git'),
        path: VERSIONS_PATH,
        fileExtension: 'md',
      }),
    },
    mongo: {
      snapshots: new MongoAdapter(config.get('recorder.versions.storage.mongo')),
      versions: new MongoAdapter(config.get('recorder.snapshots.storage.mongo')),
    },
  };

  for (const [ adapterName, adapters ] of Object.entries(adaptersTypes)) {
    describe(adapterName, () => {
      describe('#recordSnapshot', () => {
        const CONTENT = '<html><h1>ToS fixture data with UTF-8 çhãràčtęrs</h1></html>';
        let recorder;
        let id;
        let isFirstRecord;
        let record;

        before(async () => {
          recorder = new Recorder({
            versionsStorageAdapter: adapters.versions,
            snapshotsStorageAdapter: adapters.snapshots,
          });
          await recorder.initialize();
        });

        after(async () => {
          await adapters.snapshots._removeAllRecords();
          await recorder.finalize();
        });

        context('when a required param is missing', () => {
          after(async () => adapters.snapshots._removeAllRecords());

          const validParams = {
            serviceId: SERVICE_ID,
            documentType: TYPE,
            content: CONTENT,
            fetchDate: FETCH_DATE,
            mimeType: MIME_TYPE,
          };

          const paramsNameToExpectedTextInError = {
            serviceId: 'service ID',
            documentType: 'document type',
            fetchDate: 'fetch date',
            content: 'content',
            mimeType: 'mime type',
          };

          Object.entries(validParams).forEach(([testedRequiredParam]) => {
            context(`when "${testedRequiredParam}" is missing`, () => {
              it('throws an error', async () => {
                try {
                  const validParamsExceptTheOneTested = Object.fromEntries(Object.entries(validParams).filter(([paramName]) => paramName != testedRequiredParam));

                  await recorder.recordSnapshot(validParamsExceptTheOneTested);
                } catch (e) {
                  expect(e).to.be.an('error');
                  expect(e.message).to.contain(paramsNameToExpectedTextInError[testedRequiredParam]);

                  return;
                }
                expect.fail('No error was thrown');
              });
            });
          });
        });

        context('when it is the first record', () => {
          before(async () => {
            ({ id, isFirstRecord } = await recorder.recordSnapshot({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              mimeType: MIME_TYPE,
              fetchDate: FETCH_DATE,
            }));

            (record = await adapters.snapshots.getLatestRecord(SERVICE_ID, TYPE));
          });

          after(async () => adapters.snapshots._removeAllRecords());

          it('records the document with the proper content', async () => {
            expect(record.content).to.equal(CONTENT);
          });

          it('returns the record id', async () => {
            expect(record.id).to.include(id);
          });

          it('returns a boolean to know if it is the first record', async () => {
            expect(isFirstRecord).to.be.true;
          });
        });

        context('when it is not the first record', () => {
          const UPDATED_CONTENT = '<html><h1>ToS fixture data with UTF-8 çhãràčtęrs</h1><h2>Updated!</h2></html>';

          before(async () => {
            await recorder.recordSnapshot({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              mimeType: MIME_TYPE,
              fetchDate: FETCH_DATE,
            });

            ({ id, isFirstRecord } = await recorder.recordSnapshot({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: UPDATED_CONTENT,
              mimeType: MIME_TYPE,
              fetchDate: FETCH_DATE_LATER,
            }));

            (record = await adapters.snapshots.getLatestRecord(SERVICE_ID, TYPE));
          });

          after(async () => adapters.snapshots._removeAllRecords());

          it('records the document with the proper content', async () => {
            expect(record.content).to.equal(UPDATED_CONTENT);
          });

          it('returns the record id', async () => {
            expect(record.id).to.include(id);
          });

          it('returns a boolean to know if it is the first record', async () => {
            expect(isFirstRecord).to.be.false;
          });
        });

        context('when the content has not changed', () => {
          before(async () => {
            await recorder.recordSnapshot({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              mimeType: MIME_TYPE,
              fetchDate: FETCH_DATE,
            });

            ({ id, isFirstRecord } = await recorder.recordSnapshot({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              mimeType: MIME_TYPE,
              fetchDate: FETCH_DATE_LATER,
            }));

            (record = await adapters.snapshots.getLatestRecord(SERVICE_ID, TYPE));
          });

          after(async () => adapters.snapshots._removeAllRecords());

          it('does not record the document', async () => {
            expect(id).to.not.be.ok;
          });
        });
      });

      describe('#recordVersion', () => {
        const CONTENT = '# ToS fixture data with UTF-8 çhãràčtęrs';
        const SNAPSHOT_ID = '61af86dc5ff5caa74ae926ad';
        let recorder;
        let id;
        let isFirstRecord;
        let record;

        before(async () => {
          recorder = new Recorder({
            versionsStorageAdapter: adapters.versions,
            snapshotsStorageAdapter: adapters.snapshots,
          });
          await recorder.initialize();
        });

        after(async () => {
          await recorder.finalize();
        });

        context('when a required param is missing', () => {
          after(async () => adapters.versions._removeAllRecords());

          const validParams = {
            serviceId: SERVICE_ID,
            documentType: TYPE,
            content: CONTENT,
            snapshotId: SNAPSHOT_ID,
            fetchDate: FETCH_DATE,
          };

          const paramsNameToExpectedTextInError = {
            serviceId: 'service ID',
            documentType: 'document type',
            snapshotId: 'snapshot ID',
            fetchDate: 'fetch date',
            content: 'content',
          };

          Object.entries(validParams).forEach(([testedRequiredParam]) => {
            context(`when "${testedRequiredParam}" is missing`, () => {
              it('throws an error', async () => {
                try {
                  const validParamsExceptTheOneTested = Object.fromEntries(Object.entries(validParams).filter(([paramName]) => paramName != testedRequiredParam));

                  await recorder.recordVersion(validParamsExceptTheOneTested);
                } catch (e) {
                  expect(e).to.be.an('error');
                  expect(e.message).to.contain(paramsNameToExpectedTextInError[testedRequiredParam]);

                  return;
                }
                expect.fail('No error was thrown');
              });
            });
          });
        });

        context('when it is the first record', () => {
          before(async () => {
            ({ id, isFirstRecord } = await recorder.recordVersion({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotId: SNAPSHOT_ID,
              fetchDate: FETCH_DATE,
            }));

            (record = await adapters.versions.getLatestRecord(SERVICE_ID, TYPE));
          });

          after(async () => adapters.versions._removeAllRecords());

          it('records the document with the proper content', async () => {
            expect(record.content).to.equal(CONTENT);
          });

          it('returns the record id', async () => {
            expect(record.id).to.include(id);
          });

          it('returns a boolean to know if it is the first record', async () => {
            expect(isFirstRecord).to.be.true;
          });
        });

        context('when it is not the first record', () => {
          const UPDATED_CONTENT = '<html><h1>ToS fixture data with UTF-8 çhãràčtęrs</h1><h2>Updated!</h2></html>';

          before(async () => {
            await recorder.recordVersion({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotId: SNAPSHOT_ID,
              fetchDate: FETCH_DATE,
            });

            ({ id, isFirstRecord } = await recorder.recordVersion({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: UPDATED_CONTENT,
              snapshotId: SNAPSHOT_ID,
              fetchDate: FETCH_DATE_LATER,
            }));

            (record = await adapters.versions.getLatestRecord(SERVICE_ID, TYPE));
          });

          after(async () => adapters.versions._removeAllRecords());

          it('records the document with the proper content', async () => {
            expect(record.content).to.equal(UPDATED_CONTENT);
          });

          it('returns the record id', async () => {
            expect(record.id).to.include(id);
          });

          it('returns a boolean to know if it is the first record', async () => {
            expect(isFirstRecord).to.be.false;
          });
        });

        context('when the content has not changed', () => {
          before(async () => {
            await recorder.recordVersion({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotId: SNAPSHOT_ID,
              fetchDate: FETCH_DATE,
            });

            ({ id, isFirstRecord } = await recorder.recordVersion({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotId: SNAPSHOT_ID,
              fetchDate: FETCH_DATE_LATER,
            }));

            (record = await adapters.versions.getLatestRecord(SERVICE_ID, TYPE));
          });

          after(async () => adapters.versions._removeAllRecords());

          it('does not record the document', async () => {
            expect(id).to.not.be.ok;
          });
        });
      });

      describe('#recordRefilter', () => {
        const CONTENT = '# ToS fixture data with UTF-8 çhãràčtęrs';
        const SNAPSHOT_ID = '61af86dc5ff5caa74ae926ad';
        let recorder;
        let id;
        let isFirstRecord;
        let record;

        before(async () => {
          recorder = new Recorder({
            versionsStorageAdapter: adapters.versions,
            snapshotsStorageAdapter: adapters.snapshots,
          });
          await recorder.initialize();
        });

        after(async () => {
          await adapters.versions._removeAllRecords();
          await recorder.finalize();
        });

        context('when a required param is missing', () => {
          after(async () => adapters.versions._removeAllRecords());

          const validParams = {
            serviceId: SERVICE_ID,
            documentType: TYPE,
            content: CONTENT,
            snapshotId: SNAPSHOT_ID,
            fetchDate: FETCH_DATE,
          };

          const paramsNameToExpectedTextInError = {
            serviceId: 'service ID',
            documentType: 'document type',
            snapshotId: 'snapshot ID',
            fetchDate: 'fetch date',
            content: 'content',
          };

          Object.entries(validParams).forEach(([testedRequiredParam]) => {
            context(`when "${testedRequiredParam}" is missing`, () => {
              it('throws an error', async () => {
                try {
                  const validParamsExceptTheOneTested = Object.fromEntries(Object.entries(validParams).filter(([paramName]) => paramName != testedRequiredParam));

                  await recorder.recordRefilter(validParamsExceptTheOneTested);
                } catch (e) {
                  expect(e).to.be.an('error');
                  expect(e.message).to.contain(paramsNameToExpectedTextInError[testedRequiredParam]);

                  return;
                }
                expect.fail('No error was thrown');
              });
            });
          });
        });

        context('when it is the first record', () => {
          before(async () => {
            ({ id, isFirstRecord } = await recorder.recordRefilter({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotId: SNAPSHOT_ID,
              fetchDate: FETCH_DATE,
            }));

            (record = await adapters.versions.getLatestRecord(SERVICE_ID, TYPE));
          });

          after(async () => adapters.versions._removeAllRecords()); after(async () => adapters.versions._removeAllRecords());

          it('records the document with the proper content', async () => {
            expect(record.content).to.equal(CONTENT);
          });

          it('returns the record id', async () => {
            expect(record.id).to.include(id);
          });

          it('returns a boolean to know if it is the first record', async () => {
            expect(isFirstRecord).to.be.true;
          });
        });

        context('when it is not the first record', () => {
          const UPDATED_CONTENT = '<html><h1>ToS fixture data with UTF-8 çhãràčtęrs</h1><h2>Updated!</h2></html>';

          before(async () => {
            await recorder.recordRefilter({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotId: SNAPSHOT_ID,
              fetchDate: FETCH_DATE,
            });

            ({ id, isFirstRecord } = await recorder.recordRefilter({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: UPDATED_CONTENT,
              snapshotId: SNAPSHOT_ID,
              fetchDate: FETCH_DATE_LATER,
            }));

            (record = await adapters.versions.getLatestRecord(SERVICE_ID, TYPE));
          });

          after(async () => adapters.versions._removeAllRecords());

          it('records the document with the proper content', async () => {
            expect(record.content).to.equal(UPDATED_CONTENT);
          });

          it('returns the record id', async () => {
            expect(record.id).to.include(id);
          });

          it('returns a boolean to know if it is the first record', async () => {
            expect(isFirstRecord).to.be.false;
          });
        });

        context('when the content has not changed', () => {
          before(async () => {
            await recorder.recordRefilter({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotId: SNAPSHOT_ID,
              fetchDate: FETCH_DATE,
            });

            ({ id, isFirstRecord } = await recorder.recordRefilter({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotId: SNAPSHOT_ID,
              fetchDate: FETCH_DATE_LATER,
            }));

            (record = await adapters.versions.getLatestRecord(SERVICE_ID, TYPE));
          });

          after(async () => adapters.versions._removeAllRecords());

          it('does not record the document', async () => {
            expect(id).to.not.be.ok;
          });
        });
      });
    });
  }
});
