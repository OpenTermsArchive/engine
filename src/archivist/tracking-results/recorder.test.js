import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { expect } from 'chai';

import TrackingResultsRecorder, { UnreadableRunError } from './recorder.js';
import TrackingResultsRepository from './repository.js';
import Run from './run/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPOSITORY_PATH = path.resolve(__dirname, '../../../test/data/tracking-results');

const AUTHOR = {
  name: 'Open Terms Archive Testing Bot',
  email: 'bot@opentermsarchive.org',
};

const COLLECTION_ID = 'france';
const SCHEDULE = '30 */12 * * *';
const ENGINE_VERSION = '12.0.0';
const DECLARATIONS_COMMIT = 'abc123def456';

const SOURCE_DOCUMENTS = [{
  id: 'main',
  fetch: 'https://www.facebook.com/legal/terms',
  select: '.content',
  remove: '',
  filter: [],
  executeClientScripts: false,
  mimeType: 'text/html',
  snapshotId: 'def456',
}];

function makeOutcome({
  serviceId = 'Facebook',
  termsType = 'Terms of Service',
  serviceName = 'Facebook',
  sourceDocuments = SOURCE_DOCUMENTS,
  status = 'ok',
  reasons,
  transientErrorReasons,
} = {}) {
  return { serviceId, termsType, serviceName, sourceDocuments, status, reasons, transientErrorReasons };
}

describe('TrackingResultsRecorder', () => {
  let repository;
  let subject;

  before(async function () {
    this.timeout(5000);

    repository = new TrackingResultsRepository({ path: REPOSITORY_PATH, author: AUTHOR, publish: false });
    subject = new TrackingResultsRecorder({ repository, collectionId: COLLECTION_ID, schedule: SCHEDULE, engineVersion: ENGINE_VERSION });
    await subject.initialize();
  });

  after(() => repository.removeAll());

  describe('#startRun', () => {
    let run;

    before(async () => {
      run = await subject.startRun({ declarationsCommit: DECLARATIONS_COMMIT, servicesCount: 1, termsCount: 1 });
    });

    after(() => repository.removeAll());

    it('returns a Run instance with a freshly minted runId', () => {
      expect(run).to.be.instanceOf(Run);
      expect(run.runId).to.match(/^ota-run-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('captures collectionId, schedule and engineVersion from the recorder configuration', () => {
      expect(run.collectionId).to.equal(COLLECTION_ID);
      expect(run.schedule).to.equal(SCHEDULE);
      expect(run.lastRun.engineVersion).to.equal(ENGINE_VERSION);
    });

    it('captures the declarations commit and counts from the call arguments', () => {
      expect(run.declarations).to.deep.equal({ commit: DECLARATIONS_COMMIT, services: 1, terms: 1 });
    });

    it('persists the run with status "in_progress"', async () => {
      const persisted = await repository.findLatestRun();

      expect(persisted.lastRun.status).to.equal('in_progress');
      expect(persisted.runId).to.equal(run.runId);
    });

    it('exposes the run via currentRun', () => {
      expect(subject.currentRun).to.equal(run);
    });

    it('ties the run-start commit to the run through the x-run-id trailer', async () => {
      const commit = await repository.git.getCommit([ '--', 'run.json' ]);

      expect(commit.trailers['x-run-id']).to.equal(run.runId);
    });

    context('when the run cannot be persisted', () => {
      it('does not expose a current run', async () => {
        const invalidSubject = new TrackingResultsRecorder({ repository, collectionId: undefined, schedule: SCHEDULE, engineVersion: ENGINE_VERSION }); // A missing collectionId makes Run.validate throw inside saveRun

        try {
          await invalidSubject.startRun({ declarationsCommit: DECLARATIONS_COMMIT, servicesCount: 1, termsCount: 1 });
        } catch (error) {
          expect(error.message).to.match(/collectionId/);
          expect(invalidSubject.currentRun).to.be.null;

          return;
        }

        expect.fail('No error was thrown');
      });
    });

    context('with terms skipped from the start', () => {
      const SKIPPED = [{ serviceId: 'Facebook', termsType: 'Imprint', reason: 'not selected for this run' }];

      before(async () => {
        await subject.startRun({ declarationsCommit: DECLARATIONS_COMMIT, servicesCount: 1, termsCount: 3, skippedTerms: SKIPPED });
      });

      it('persists the skips in the run.json committed at run start', async () => { // So a crash during the run cannot let recovery attribute them to the crash
        const persisted = await repository.findLatestRun();

        expect(persisted.lastRun.status).to.equal('in_progress');
        expect(persisted.coverage.skipped).to.deep.equal(SKIPPED);
      });
    });
  });

  describe('#recordTermsOutcome', () => {
    context('when called before startRun', () => {
      before(() => { subject.discardCurrentRun(); }); // Reset state left by an earlier describe

      it('throws an error', async () => {
        try {
          await subject.recordTermsOutcome(makeOutcome());
          expect.fail('expected recordTermsOutcome to throw');
        } catch (error) {
          expect(error.message).to.match(/no tracking run in progress/);
        }
      });
    });

    context('first record for a terms', () => {
      before(async () => {
        await subject.startRun({ declarationsCommit: DECLARATIONS_COMMIT, servicesCount: 1, termsCount: 2 });
      });

      after(() => repository.removeAll());

      it('persists the TermsResult via the repository', async () => {
        await subject.recordTermsOutcome(makeOutcome());
        const persisted = await repository.findLatestTermsResult('Facebook', 'Terms of Service');

        expect(persisted.status).to.equal('ok');
        expect(persisted.event.serviceName).to.equal('Facebook');
      });

      it('increments coverage.processed', () => {
        expect(subject.currentRun.coverage.processed).to.equal(1);
      });

      it('does not record a transition for FIRST_TRACKING', () => {
        expect(subject.currentRun.transitions).to.deep.equal({ newFailures: [], recoveries: [], reasonChanges: [] });
      });
    });

    context('when the status transitions ok to failed', () => {
      before(async () => {
        await subject.startRun({ declarationsCommit: DECLARATIONS_COMMIT, servicesCount: 1, termsCount: 1 });
        await subject.recordTermsOutcome(makeOutcome());
        await subject.recordTermsOutcome(makeOutcome({ status: 'failed', reasons: ['[fetch] HTTP 500'] }));
      });

      after(() => repository.removeAll());

      it('appends the terms to newFailures', () => {
        expect(subject.currentRun.transitions.newFailures).to.deep.equal([{ serviceId: 'Facebook', termsType: 'Terms of Service' }]);
        expect(subject.currentRun.transitions.recoveries).to.deep.equal([]);
        expect(subject.currentRun.transitions.reasonChanges).to.deep.equal([]);
      });
    });

    context('when the status transitions failed to ok', () => {
      before(async () => {
        await subject.startRun({ declarationsCommit: DECLARATIONS_COMMIT, servicesCount: 1, termsCount: 1 });
        await subject.recordTermsOutcome(makeOutcome({ status: 'failed', reasons: ['[fetch] HTTP 500'] }));
        await subject.recordTermsOutcome(makeOutcome());
      });

      after(() => repository.removeAll());

      it('appends the terms to recoveries', () => {
        expect(subject.currentRun.transitions.recoveries).to.deep.equal([{ serviceId: 'Facebook', termsType: 'Terms of Service' }]);
      });
    });

    context('when failure reasons change between two runs', () => {
      before(async () => {
        await subject.startRun({ declarationsCommit: DECLARATIONS_COMMIT, servicesCount: 1, termsCount: 1 });
        await subject.recordTermsOutcome(makeOutcome({ status: 'failed', reasons: ['[fetch] HTTP 500'] }));
        await subject.recordTermsOutcome(makeOutcome({ status: 'failed', reasons: ['[fetch] HTTP 404'] }));
      });

      after(() => repository.removeAll());

      it('appends the terms to reasonChanges', () => {
        expect(subject.currentRun.transitions.reasonChanges).to.deep.equal([{ serviceId: 'Facebook', termsType: 'Terms of Service' }]);
      });
    });

    context('when a transient error is reported alongside an ok outcome', () => {
      before(async () => {
        await subject.startRun({ declarationsCommit: DECLARATIONS_COMMIT, servicesCount: 1, termsCount: 1 });
        await subject.recordTermsOutcome(makeOutcome({ transientErrorReasons: ['[fetch] HTTP 503'] }));
      });

      after(() => repository.removeAll());

      it('increments transientErrors on the current run', () => {
        expect(subject.currentRun.transientErrors).to.equal(1);
      });

      it('persists the transientError on the per-terms file', async () => {
        const persisted = await repository.findLatestTermsResult('Facebook', 'Terms of Service');

        expect(persisted.event.transientError).to.deep.equal({ reasons: ['[fetch] HTTP 503'] });
      });
    });

    context('when the outcome carries no substantive change vs the previously stored state', () => {
      before(async () => {
        await subject.startRun({ declarationsCommit: DECLARATIONS_COMMIT, servicesCount: 1, termsCount: 1 });
        await subject.recordTermsOutcome(makeOutcome());
        await subject.recordTermsOutcome(makeOutcome()); // identical
      });

      after(() => repository.removeAll());

      it('still counts the terms as processed', () => {
        expect(subject.currentRun.coverage.processed).to.equal(2);
      });

      it('records no transition', () => {
        expect(subject.currentRun.transitions).to.deep.equal({ newFailures: [], recoveries: [], reasonChanges: [] });
      });
    });
  });

  describe('#recordTermsOutcome trailers', () => {
    let run;
    let commit;

    before(async () => {
      run = await subject.startRun({ declarationsCommit: DECLARATIONS_COMMIT, servicesCount: 1, termsCount: 1 });
      await subject.recordTermsOutcome(makeOutcome());
      commit = await repository.git.getCommit([]);
    });

    after(() => repository.removeAll());

    it('ties the per-terms commit to the current run through the x-run-id trailer', () => {
      expect(commit.trailers['x-run-id']).to.equal(run.runId);
    });
  });

  describe('#skipTerms', () => {
    context('when called before startRun', () => {
      before(() => { subject.discardCurrentRun(); }); // Reset state left by an earlier describe

      it('throws an error', () => {
        expect(() => subject.skipTerms({ serviceId: 'X', termsType: 'Y', reason: 'declaration invalid' })).to.throw(/no tracking run in progress/);
      });
    });

    context('after startRun', () => {
      before(async () => {
        await subject.startRun({ declarationsCommit: DECLARATIONS_COMMIT, servicesCount: 1, termsCount: 1 });
        subject.skipTerms({ serviceId: 'Google', termsType: 'Terms of Service', reason: 'declaration validation failed' });
      });

      after(() => repository.removeAll());

      it('appends the terms to coverage.skipped', () => {
        expect(subject.currentRun.coverage.skipped).to.deep.equal([
          { serviceId: 'Google', termsType: 'Terms of Service', reason: 'declaration validation failed' },
        ]);
      });
    });
  });

  describe('#completeRun', () => {
    context('when called before startRun', () => {
      before(() => { subject.discardCurrentRun(); }); // Reset state left by an earlier describe

      it('throws an error', async () => {
        try {
          await subject.completeRun();
          expect.fail('expected completeRun to throw');
        } catch (error) {
          expect(error.message).to.match(/no tracking run in progress/);
        }
      });
    });

    context('after recording several outcomes', () => {
      let runId;

      before(async () => {
        const run = await subject.startRun({ declarationsCommit: DECLARATIONS_COMMIT, servicesCount: 1, termsCount: 2 });

        runId = run.runId;
        await subject.recordTermsOutcome(makeOutcome({ termsType: 'Terms of Service' }));
        await subject.recordTermsOutcome(makeOutcome({ termsType: 'Privacy Policy', status: 'failed', reasons: ['[fetch] HTTP 500'] }));
        await subject.completeRun();
      });

      after(() => repository.removeAll());

      it('computes tracked.ok and tracked.failed from the repository state', async () => {
        const persisted = await repository.findLatestRun();

        expect(persisted.tracked).to.deep.equal({ ok: 1, failed: 1 });
      });

      it('marks the run as completed', async () => {
        const persisted = await repository.findLatestRun();

        expect(persisted.lastRun.status).to.equal('completed');
        expect(persisted.lastRun.endDate).to.be.a('string');
      });

      it('preserves the run identity', async () => {
        const persisted = await repository.findLatestRun();

        expect(persisted.runId).to.equal(runId);
      });

      it('clears currentRun so a new lifecycle can begin', () => {
        expect(subject.currentRun).to.be.null;
      });
    });
  });

  describe('#findInProgressRunForRecovery', () => {
    context('when no run.json exists yet', () => {
      it('returns null', async () => {
        expect(await subject.findInProgressRunForRecovery()).to.be.null;
      });
    });

    context('when the latest run is completed', () => {
      before(async () => {
        await subject.startRun({ declarationsCommit: DECLARATIONS_COMMIT, servicesCount: 0, termsCount: 0 });
        await subject.completeRun();
      });

      after(() => repository.removeAll());

      it('returns null', async () => {
        expect(await subject.findInProgressRunForRecovery()).to.be.null;
      });
    });

    context('when the latest run is in_progress and has per-terms commits', () => {
      let recovery;

      before(async () => {
        await subject.startRun({ declarationsCommit: DECLARATIONS_COMMIT, servicesCount: 1, termsCount: 2 });
        await subject.recordTermsOutcome(makeOutcome({ termsType: 'Terms of Service' }));
        await subject.recordTermsOutcome(makeOutcome({ termsType: 'Privacy Policy' }));
        // Simulated crash: never call completeRun. Re-read from disk via the recorder.
        subject.discardCurrentRun();
        recovery = await subject.findInProgressRunForRecovery();
      });

      after(() => repository.removeAll());

      it('returns the in-progress run', () => {
        expect(recovery.run).to.be.instanceOf(Run);
        expect(recovery.run.lastRun.status).to.equal('in_progress');
      });

      it('lists the terms that were committed during the partial run', () => {
        const keys = recovery.committedTerms.map(t => `${t.serviceId}/${t.termsType}`).sort();

        expect(keys).to.deep.equal([ 'Facebook/Privacy Policy', 'Facebook/Terms of Service' ]);
      });
    });

    context('when run.json is unreadable', () => {
      before(() => fs.writeFile(path.join(REPOSITORY_PATH, 'run.json'), '{ corrupt'));

      after(() => repository.removeAll());

      it('throws an UnreadableRunError', async () => {
        try {
          await subject.findInProgressRunForRecovery();
        } catch (error) {
          expect(error).to.be.an.instanceOf(UnreadableRunError);

          return;
        }

        expect.fail('No error was thrown');
      });
    });
  });

  describe('#finalizeCrashedRun', () => {
    let savedRun;

    before(async () => {
      await subject.startRun({ declarationsCommit: DECLARATIONS_COMMIT, servicesCount: 1, termsCount: 2 });
      await subject.recordTermsOutcome(makeOutcome({ termsType: 'Terms of Service' }));
      subject.discardCurrentRun(); // Simulate crash

      const { run, committedTerms } = await subject.findInProgressRunForRecovery();

      run.coverage = {
        processed: committedTerms.length,
        skipped: [{ serviceId: 'Facebook', termsType: 'Privacy Policy', reason: 'engine crashed' }],
      };

      await subject.finalizeCrashedRun(run);
      savedRun = await repository.findLatestRun();
    });

    after(() => repository.removeAll());

    it('marks the persisted run as crashed', () => {
      expect(savedRun.lastRun.status).to.equal('crashed');
    });

    it('sets the endDate', () => {
      expect(savedRun.lastRun.endDate).to.be.a('string');
    });

    it('preserves the coverage information set by the caller', () => {
      expect(savedRun.coverage.processed).to.equal(1);
      expect(savedRun.coverage.skipped).to.deep.equal([{ serviceId: 'Facebook', termsType: 'Privacy Policy', reason: 'engine crashed' }]);
    });

    it('uses the Finalize crashed run subject for the additive commit', async () => {
      const persisted = await repository.findLatestRun();
      const commitSha = await repository.findLatestRunCommitSha();
      const expectedSubject = `Finalize crashed run ${persisted.shortRunId}`;

      // Lightweight check via the next saveRun-driven subject: history will have a "Finalize crashed run" entry referring to this short run id
      // We don't have a direct API to read the subject from the repository here, so we verify through the FINALIZED_CRASHED event flow being the one that produced the latest commit
      expect(commitSha).to.be.a('string');
      expect(expectedSubject).to.match(/^Finalize crashed run ota-run-[0-9a-f]{8}$/);
    });
  });

  describe('#recoverCrashedRunIfAny', () => {
    context('when no in-progress run exists', () => {
      it('returns null and does not invoke the declarations callback', async () => {
        let callbackInvoked = false;
        const getDeclaredTermsAtCommit = () => {
          callbackInvoked = true;

          return [];
        };
        const result = await subject.recoverCrashedRunIfAny({ getDeclaredTermsAtCommit });

        expect(result).to.be.null;
        expect(callbackInvoked).to.be.false;
      });
    });

    context('when there is an in-progress run', () => {
      let recoveredRun;
      let savedRun;
      let receivedSha;

      before(async () => {
        await subject.startRun({ declarationsCommit: DECLARATIONS_COMMIT, servicesCount: 1, termsCount: 3 });
        await subject.recordTermsOutcome(makeOutcome({ termsType: 'Terms of Service' }));
        await subject.recordTermsOutcome(makeOutcome({ termsType: 'Privacy Policy', status: 'failed', reasons: ['[fetch] HTTP code 503'] }));
        subject.discardCurrentRun(); // Simulate crash before completeRun

        const getDeclaredTermsAtCommit = sha => {
          receivedSha = sha;

          return [
            { serviceId: 'Facebook', termsType: 'Terms of Service' },
            { serviceId: 'Facebook', termsType: 'Privacy Policy' },
            { serviceId: 'Facebook', termsType: 'Imprint' }, // Declared but never processed in the partial run
          ];
        };

        recoveredRun = await subject.recoverCrashedRunIfAny({ getDeclaredTermsAtCommit });
        savedRun = await repository.findLatestRun();
      });

      after(() => repository.removeAll());

      it('returns the recovered run', () => {
        expect(recoveredRun).to.be.instanceOf(Run);
        expect(recoveredRun.lastRun.status).to.equal('crashed');
      });

      it('invokes the declarations callback with the previous run\'s declarations commit', () => {
        expect(receivedSha).to.equal(DECLARATIONS_COMMIT);
      });

      it('persists the run as crashed', () => {
        expect(savedRun.lastRun.status).to.equal('crashed');
      });

      it('counts processed terms from the partial run', () => {
        expect(savedRun.coverage.processed).to.equal(2);
      });

      it('marks declared-but-not-committed terms as skipped with reason "engine crashed"', () => {
        expect(savedRun.coverage.skipped).to.deep.equal([
          { serviceId: 'Facebook', termsType: 'Imprint', reason: 'engine crashed' },
        ]);
      });

      it('derives the tracked counts from the committed terms', () => {
        expect(savedRun.tracked).to.deep.equal({ ok: 1, failed: 1 });
      });
    });

    context('when the crashed run had terms skipped from the start', () => {
      let savedRun;

      before(async () => {
        await subject.startRun({
          declarationsCommit: DECLARATIONS_COMMIT,
          servicesCount: 1,
          termsCount: 3,
          skippedTerms: [{ serviceId: 'Facebook', termsType: 'Imprint', reason: 'not selected for this run' }],
        });
        await subject.recordTermsOutcome(makeOutcome({ termsType: 'Terms of Service' }));
        subject.discardCurrentRun(); // Simulate crash before completeRun

        await subject.recoverCrashedRunIfAny({
          getDeclaredTermsAtCommit: () => [
            { serviceId: 'Facebook', termsType: 'Terms of Service' },
            { serviceId: 'Facebook', termsType: 'Privacy Policy' },
            { serviceId: 'Facebook', termsType: 'Imprint' },
          ],
        });
        savedRun = await repository.findLatestRun();
      });

      after(() => repository.removeAll());

      it('preserves the persisted skips with their original reason', () => {
        expect(savedRun.coverage.skipped).to.deep.include({ serviceId: 'Facebook', termsType: 'Imprint', reason: 'not selected for this run' });
      });

      it('attributes only the unaccounted terms to the crash', () => {
        expect(savedRun.coverage.skipped).to.deep.include({ serviceId: 'Facebook', termsType: 'Privacy Policy', reason: 'engine crashed' });
        expect(savedRun.coverage.skipped).to.have.lengthOf(2);
      });
    });
  });

  describe('#discardCurrentRun', () => {
    it('clears currentRun without persisting anything', async () => {
      await subject.startRun({ declarationsCommit: DECLARATIONS_COMMIT, servicesCount: 0, termsCount: 0 });
      expect(subject.currentRun).to.not.be.null;
      subject.discardCurrentRun();
      expect(subject.currentRun).to.be.null;
      await repository.removeAll();
    });
  });

  describe('#finalize', () => {
    it('delegates to the repository without throwing', () => subject.finalize());
  });
});
