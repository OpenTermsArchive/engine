import { expect } from 'chai';
import config from 'config';

import Snapshot from './snapshot.js';
import Version from './version.js';

import Recorder from './index.js';

const isWindows = process.platform === 'win32';

const MIME_TYPE = 'text/html';
const FETCH_DATE = new Date('2000-01-01T12:00:00.000Z');
const FETCH_DATE_LATER = new Date('2000-01-02T12:00:00.000Z');

describe('Recorder', () => {
  const SERVICE_ID = 'test_service';
  const TYPE = 'Terms of Service';

  for (const repositoryType of [ 'git', 'mongo' ]) {
    describe(repositoryType, () => {
      let recorder;

      before(async function () {
        if (repositoryType == 'mongo' && isWindows) {
          console.log('MongoDB tests are unstable on Windows due to race condition in connection cleanup.');
          console.log('Lacking a production use case for Mongo on Windows, we skip tests. Please reach out if you have a use case.');
          // On Windows, when multiple repositories connect to the same MongoDB server and are closed in parallel or even sequentially, unhandled "Operation interrupted because client was closed" errors occur after all tests pass.
          // The issue does not occur on Linux or macOS, so it appears to be a platform-specific difference in how the MongoDB driver handles connection pool cleanup during client.close().
          this.skip();
        }
        const options = config.util.cloneDeep(config.get('@opentermsarchive/engine.recorder'));

        options.versions.storage.type = repositoryType;
        options.snapshots.storage.type = repositoryType;

        recorder = new Recorder(options);
        await recorder.initialize();
      });

      after(() => recorder?.finalize());

      context('Snapshot', () => {
        describe('#record', () => {
          const CONTENT = '<html><h1>ToS fixture data with UTF-8 çhãràčtęrs</h1></html>';

          let id;
          let isFirstRecord;
          let record;

          context('when a required param is missing', () => {
            after(() => recorder.snapshotsRepository.removeAll());

            Snapshot.REQUIRED_PARAMS.forEach(testedRequiredParam => {
              context(`when "${testedRequiredParam}" is missing`, () => {
                it('throws an error', async () => {
                  try {
                    const validParamsExceptTheOneTested = Snapshot.REQUIRED_PARAMS.filter(paramName => paramName != testedRequiredParam).reduce(
                      (accumulator, currentValue) => {
                        accumulator[currentValue] = 'non null value';

                        return accumulator;
                      },
                      {},
                    );

                    await recorder.record(new Snapshot({ ...validParamsExceptTheOneTested }));
                  } catch (e) {
                    expect(e).to.be.an('error');
                    expect(e.message).to.contain(testedRequiredParam);

                    return;
                  }
                  expect.fail('No error was thrown');
                });
              });
            });
          });

          context('when it is the first record', () => {
            before(async () => {
              ({ id, isFirstRecord } = await recorder.record(new Snapshot({
                serviceId: SERVICE_ID,
                termsType: TYPE,
                content: CONTENT,
                mimeType: MIME_TYPE,
                fetchDate: FETCH_DATE,
              })));

              record = await recorder.snapshotsRepository.findLatest(SERVICE_ID, TYPE);
            });

            after(() => recorder.snapshotsRepository.removeAll());

            it('records the snapshot with the proper content', async () => {
              expect(await record.content).to.equal(CONTENT);
            });

            it('returns the record id', () => {
              expect(record.id).to.include(id);
            });

            it('states that it is the first record', () => {
              expect(isFirstRecord).to.be.true;
            });
          });

          context('when it is not the first record', () => {
            const UPDATED_CONTENT = '<html><h1>ToS fixture data with UTF-8 çhãràčtęrs</h1><h2>Updated!</h2></html>';

            before(async () => {
              await recorder.record(new Snapshot({
                serviceId: SERVICE_ID,
                termsType: TYPE,
                content: CONTENT,
                mimeType: MIME_TYPE,
                fetchDate: FETCH_DATE,
              }));

              ({ id, isFirstRecord } = await recorder.record(new Snapshot({
                serviceId: SERVICE_ID,
                termsType: TYPE,
                content: UPDATED_CONTENT,
                mimeType: MIME_TYPE,
                fetchDate: FETCH_DATE_LATER,
              })));

              record = await recorder.snapshotsRepository.findLatest(SERVICE_ID, TYPE);
            });

            after(() => recorder.snapshotsRepository.removeAll());

            it('records the snapshot with the proper content', async () => {
              expect(await record.content).to.equal(UPDATED_CONTENT);
            });

            it('returns the record id', () => {
              expect(record.id).to.include(id);
            });

            it('states that it is not the first record', () => {
              expect(isFirstRecord).to.be.false;
            });
          });

          context('when the content has not changed', () => {
            before(async () => {
              await recorder.record(new Snapshot({
                serviceId: SERVICE_ID,
                termsType: TYPE,
                content: CONTENT,
                mimeType: MIME_TYPE,
                fetchDate: FETCH_DATE,
              }));

              ({ id, isFirstRecord } = await recorder.record(new Snapshot({
                serviceId: SERVICE_ID,
                termsType: TYPE,
                content: CONTENT,
                mimeType: MIME_TYPE,
                fetchDate: FETCH_DATE_LATER,
              })));

              record = await recorder.snapshotsRepository.findLatest(SERVICE_ID, TYPE);
            });

            after(() => recorder.snapshotsRepository.removeAll());

            it('does not record the snapshot', () => {
              expect(id).to.not.be.ok;
            });
          });
        });
      });

      context('Version', () => {
        describe('#record', () => {
          const CONTENT = '# ToS fixture data with UTF-8 çhãràčtęrs';
          const SNAPSHOT_ID = '61af86dc5ff5caa74ae926ad';

          let id;
          let isFirstRecord;
          let record;

          context('when a required param is missing', () => {
            after(() => recorder.versionsRepository.removeAll());

            Version.REQUIRED_PARAMS.forEach(testedRequiredParam => {
              context(`when "${testedRequiredParam}" is missing`, () => {
                it('throws an error', async () => {
                  try {
                    const validParamsExceptTheOneTested = Version.REQUIRED_PARAMS.filter(paramName => paramName != testedRequiredParam).reduce(
                      (accumulator, currentValue) => {
                        accumulator[currentValue] = 'no null value';

                        return accumulator;
                      },
                      {},
                    );

                    await recorder.record(new Version({ ...validParamsExceptTheOneTested }));
                  } catch (e) {
                    expect(e).to.be.an('error');
                    expect(e.message).to.contain(testedRequiredParam);

                    return;
                  }
                  expect.fail('No error was thrown');
                });
              });
            });
          });

          context('when it is the first record', () => {
            before(async () => {
              ({ id, isFirstRecord } = await recorder.record(new Version({
                serviceId: SERVICE_ID,
                termsType: TYPE,
                content: CONTENT,
                snapshotIds: [SNAPSHOT_ID],
                fetchDate: FETCH_DATE,
              })));

              record = await recorder.versionsRepository.findLatest(SERVICE_ID, TYPE);
            });

            after(() => recorder.versionsRepository.removeAll());

            it('records the version with the proper content', async () => {
              expect(await record.content).to.equal(CONTENT);
            });

            it('returns the record id', () => {
              expect(record.id).to.include(id);
            });

            it('states that it is the first record', () => {
              expect(isFirstRecord).to.be.true;
            });
          });

          context('when it is not the first record', () => {
            const UPDATED_CONTENT = '<html><h1>ToS fixture data with UTF-8 çhãràčtęrs</h1><h2>Updated!</h2></html>';

            before(async () => {
              await recorder.record(new Version({
                serviceId: SERVICE_ID,
                termsType: TYPE,
                content: CONTENT,
                snapshotIds: [SNAPSHOT_ID],
                fetchDate: FETCH_DATE,
              }));

              ({ id, isFirstRecord } = await recorder.record(new Version({
                serviceId: SERVICE_ID,
                termsType: TYPE,
                content: UPDATED_CONTENT,
                snapshotIds: [SNAPSHOT_ID],
                fetchDate: FETCH_DATE_LATER,
              })));

              record = await recorder.versionsRepository.findLatest(SERVICE_ID, TYPE);
            });

            after(() => recorder.versionsRepository.removeAll());

            it('records the version with the proper content', async () => {
              expect(await record.content).to.equal(UPDATED_CONTENT);
            });

            it('records in the version that it is not a technical upgrade version', () => {
              expect(record.isTechnicalUpgrade).to.equal(false);
            });

            it('returns the record id', () => {
              expect(record.id).to.include(id);
            });

            it('states that it is not the first record', () => {
              expect(isFirstRecord).to.be.false;
            });
          });

          context('when the content has not changed', () => {
            before(async () => {
              await recorder.record(new Version({
                serviceId: SERVICE_ID,
                termsType: TYPE,
                content: CONTENT,
                snapshotIds: [SNAPSHOT_ID],
                fetchDate: FETCH_DATE,
              }));

              ({ id, isFirstRecord } = await recorder.record(new Version({
                serviceId: SERVICE_ID,
                termsType: TYPE,
                content: CONTENT,
                snapshotIds: [SNAPSHOT_ID],
                fetchDate: FETCH_DATE_LATER,
              })));

              record = await recorder.versionsRepository.findLatest(SERVICE_ID, TYPE);
            });

            after(() => recorder.versionsRepository.removeAll());

            it('does not record any version', () => {
              expect(id).to.not.be.ok;
            });
          });

          context('when it is an extraction only', () => {
            const CONTENT = '# ToS fixture data with UTF-8 çhãràčtęrs';
            const SNAPSHOT_ID = '61af86dc5ff5caa74ae926ad';

            let id;
            let isFirstRecord;
            let record;

            context('when it is the first record', () => {
              before(async () => {
                ({ id, isFirstRecord } = await recorder.record(new Version({
                  serviceId: SERVICE_ID,
                  termsType: TYPE,
                  content: CONTENT,
                  snapshotIds: [SNAPSHOT_ID],
                  fetchDate: FETCH_DATE,
                  isTechnicalUpgrade: true,
                })));

                record = await recorder.versionsRepository.findLatest(SERVICE_ID, TYPE);
              });

              after(() => recorder.versionsRepository.removeAll());

              it('records the version with the proper content', async () => {
                expect(await record.content).to.equal(CONTENT);
              });

              it('returns the record id', () => {
                expect(record.id).to.include(id);
              });

              it('states that it is the first record', () => {
                expect(isFirstRecord).to.be.true;
              });
            });

            context('when it is not the first record', () => {
              const UPDATED_CONTENT = '<html><h1>ToS fixture data with UTF-8 çhãràčtęrs</h1><h2>Updated!</h2></html>';

              before(async () => {
                await recorder.record(new Version({
                  serviceId: SERVICE_ID,
                  termsType: TYPE,
                  content: CONTENT,
                  snapshotIds: [SNAPSHOT_ID],
                  fetchDate: FETCH_DATE,
                }));

                ({ id, isFirstRecord } = await recorder.record(new Version({
                  serviceId: SERVICE_ID,
                  termsType: TYPE,
                  content: UPDATED_CONTENT,
                  snapshotIds: [SNAPSHOT_ID],
                  fetchDate: FETCH_DATE_LATER,
                  isTechnicalUpgrade: true,
                })));

                record = await recorder.versionsRepository.findLatest(SERVICE_ID, TYPE);
              });

              after(() => recorder.versionsRepository.removeAll());

              it('records the version with the proper content', async () => {
                expect(await record.content).to.equal(UPDATED_CONTENT);
              });

              it('records in the version that it is an technical upgrade version', () => {
                expect(record.isTechnicalUpgrade).to.equal(true);
              });

              it('returns the record id', () => {
                expect(record.id).to.include(id);
              });

              it('states that it is not the first record', () => {
                expect(isFirstRecord).to.be.false;
              });
            });

            context('when the content has not changed', () => {
              before(async () => {
                await recorder.record(new Version({
                  serviceId: SERVICE_ID,
                  termsType: TYPE,
                  content: CONTENT,
                  snapshotIds: [SNAPSHOT_ID],
                  fetchDate: FETCH_DATE,
                }));

                ({ id, isFirstRecord } = await recorder.record(new Version({
                  serviceId: SERVICE_ID,
                  termsType: TYPE,
                  content: CONTENT,
                  snapshotIds: [SNAPSHOT_ID],
                  fetchDate: FETCH_DATE_LATER,
                  isTechnicalUpgrade: true,
                })));

                record = await recorder.versionsRepository.findLatest(SERVICE_ID, TYPE);
              });

              after(() => recorder.versionsRepository.removeAll());

              it('does not record any version', () => {
                expect(id).to.not.be.ok;
              });
            });
          });
        });
      });
    });
  }
});
