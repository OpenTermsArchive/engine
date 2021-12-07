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
        const MIME_TYPE = 'text/html';
        let recorder;
        let id;
        let isFirstRecord;
        let record;

        before(async () => {
          recorder = new Recorder({
            versionsStorageAdapter: adapters.versions,
            snapshotsStorageAdapter: adapters.snapshots,
          });
          await recorder.init();
        });

        after(async () => {
          await adapters.snapshots._removeAllRecords();
        });

        context('when it is the first record', () => {
          before(async () => {
            ({ id, isFirstRecord } = await recorder.recordSnapshot({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              mimeType: MIME_TYPE,
            }));

            (record = await adapters.snapshots.getLatestRecord(SERVICE_ID, TYPE));
          });

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
            });

            ({ id, isFirstRecord } = await recorder.recordSnapshot({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: UPDATED_CONTENT,
              mimeType: MIME_TYPE,
            }));

            (record = await adapters.snapshots.getLatestRecord(SERVICE_ID, TYPE));
          });

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
            });

            ({ id, isFirstRecord } = await recorder.recordSnapshot({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              mimeType: MIME_TYPE,
            }));

            (record = await adapters.snapshots.getLatestRecord(SERVICE_ID, TYPE));
          });

          it('does not record the document', async () => {
            expect(id).to.equal(null);
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
          await recorder.init();
        });

        after(async () => {
          await adapters.versions._removeAllRecords();
        });

        context('when it is the first record', () => {
          before(async () => {
            ({ id, isFirstRecord } = await recorder.recordVersion({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotId: SNAPSHOT_ID,
            }));

            (record = await adapters.versions.getLatestRecord(SERVICE_ID, TYPE));
          });

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
            });

            ({ id, isFirstRecord } = await recorder.recordVersion({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: UPDATED_CONTENT,
              snapshotId: SNAPSHOT_ID,
            }));

            (record = await adapters.versions.getLatestRecord(SERVICE_ID, TYPE));
          });

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
            });

            ({ id, isFirstRecord } = await recorder.recordVersion({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotId: SNAPSHOT_ID,
            }));

            (record = await adapters.versions.getLatestRecord(SERVICE_ID, TYPE));
          });

          it('does not record the document', async () => {
            expect(id).to.equal(null);
          });
        });

        context('when snapshot ID is not provided', () => {
          it('throws an error', async () => {
            try {
              await recorder.recordVersion({ serviceId: SERVICE_ID, documentType: TYPE, content: CONTENT });
            } catch (e) {
              expect(e).to.be.an('error');
              expect(e.message).to.contain('snapshot ID');

              return;
            }
            expect.fail('No error was thrown');
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
          await recorder.init();
        });

        after(async () => {
          await adapters.versions._removeAllRecords();
        });

        context('when it is the first record', () => {
          before(async () => {
            ({ id, isFirstRecord } = await recorder.recordRefilter({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotId: SNAPSHOT_ID,
            }));

            (record = await adapters.versions.getLatestRecord(SERVICE_ID, TYPE));
          });

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
            });

            ({ id, isFirstRecord } = await recorder.recordRefilter({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: UPDATED_CONTENT,
              snapshotId: SNAPSHOT_ID,
            }));

            (record = await adapters.versions.getLatestRecord(SERVICE_ID, TYPE));
          });

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
            });

            ({ id, isFirstRecord } = await recorder.recordRefilter({
              serviceId: SERVICE_ID,
              documentType: TYPE,
              content: CONTENT,
              snapshotId: SNAPSHOT_ID,
            }));

            (record = await adapters.versions.getLatestRecord(SERVICE_ID, TYPE));
          });

          it('does not record the document', async () => {
            expect(id).to.equal(null);
          });
        });

        context('when snapshot ID is not provided', () => {
          it('throws an error', async () => {
            try {
              await recorder.recordRefilter({ serviceId: SERVICE_ID, documentType: TYPE, content: CONTENT });
            } catch (e) {
              expect(e).to.be.an('error');
              expect(e.message).to.contain('snapshot ID');

              return;
            }
            expect.fail('No error was thrown');
          });
        });
      });
    });
  }
});
