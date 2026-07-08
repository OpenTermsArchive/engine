import fsApi from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { expect } from 'chai';

import Git from '../../git/index.js';

import TrackingResultsRepository from './repository.js';
import { EVENT_TYPES as RUN_EVENT_TYPES } from './run/dataMapper.js';
import Run from './run/index.js';
import { EVENT_TYPES as TERMS_RESULT_EVENT_TYPES } from './terms-result/dataMapper.js';
import TermsResult, { STATUSES } from './terms-result/index.js';

const fs = fsApi.promises;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPOSITORY_PATH = path.resolve(__dirname, '../../../test/data/tracking-results');

const AUTHOR = {
  name: 'Open Terms Archive Testing Bot',
  email: 'bot@opentermsarchive.org',
};

const SERVICE_ID = 'Facebook';
const TERMS_TYPE = 'Terms of Service';
const SERVICE_NAME = 'Facebook';

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

function makeResult({
  status = STATUSES.ok,
  serviceName = SERVICE_NAME,
  sourceDocuments = SOURCE_DOCUMENTS,
  reasons,
  transientError,
  serviceId = SERVICE_ID,
  termsType = TERMS_TYPE,
  date = '2026-01-10T10:30:00Z',
} = {}) {
  const event = { date, serviceName, sourceDocuments };

  if (reasons) {
    event.reasons = reasons;
  }

  if (transientError) {
    event.transientError = transientError;
  }

  return new TermsResult({ serviceId, termsType, status, event });
}

function makeRun({ runId = 'ota-run-f47ac10b-58cc-4372-a567-0e02b2c3d479' } = {}) {
  return new Run({
    runId,
    collectionId: 'france',
    schedule: '30 */12 * * *',
    startDate: '2026-04-06T10:30:00Z',
    engineVersion: '12.0.0',
    declarationsCommit: 'abc123def456',
    servicesCount: 1,
    termsCount: 1,
  });
}

describe('TrackingResultsRepository', () => {
  let subject;
  let git;

  before(async function () {
    this.timeout(5000);

    git = new Git({ path: REPOSITORY_PATH, author: AUTHOR });
    await git.initialize();

    subject = new TrackingResultsRepository({ path: REPOSITORY_PATH, author: AUTHOR, publish: false });
    await subject.initialize();
  });

  after(() => subject.removeAll());

  describe('#saveTermsResult', () => {
    context('when no previous result exists', () => {
      let saved;
      let commit;

      before(async () => {
        saved = await subject.saveTermsResult(makeResult());
        ([commit] = await git.log());
      });

      after(() => subject.removeAll());

      it('returns the commit SHA', () => {
        expect(saved.sha).to.be.a('string').with.length.greaterThan(6);
      });

      it('returns the FIRST_TRACKING event type', () => {
        expect(saved.eventType).to.equal(TERMS_RESULT_EVENT_TYPES.FIRST_TRACKING);
      });

      it('creates a commit with the first-record subject', () => {
        expect(commit.message).to.equal('Record first tracking of Facebook Terms of Service');
      });

      it('persists the file at the expected path', () => {
        expect(fsApi.existsSync(path.join(REPOSITORY_PATH, 'Facebook', 'Terms of Service.json'))).to.be.true;
      });

      it('persists JSON matching toJSON of the TermsResult', async () => {
        const content = JSON.parse(await fs.readFile(path.join(REPOSITORY_PATH, 'Facebook', 'Terms of Service.json'), 'utf8'));

        expect(content).to.deep.equal({
          status: 'ok',
          event: {
            date: '2026-01-10T10:30:00Z',
            serviceName: 'Facebook',
            sourceDocuments: SOURCE_DOCUMENTS,
          },
        });
      });

      it('uses the event date as the commit date', () => {
        expect(new Date(commit.date).toISOString()).to.equal('2026-01-10T10:30:00.000Z');
      });
    });

    context('when no substantive change', () => {
      let saved;
      let commitsBefore;

      before(async () => {
        await subject.saveTermsResult(makeResult());
        commitsBefore = (await git.log()).length;
        saved = await subject.saveTermsResult(makeResult({ date: '2026-02-10T10:30:00Z' }));
      });

      after(() => subject.removeAll());

      it('returns null sha and null event type', () => {
        expect(saved).to.deep.equal({ sha: null, eventType: null });
      });

      it('does not create a new commit', async () => {
        expect((await git.log()).length).to.equal(commitsBefore);
      });
    });

    context('with trailers', () => {
      const RUN_ID = 'ota-run-f47ac10b-58cc-4372-a567-0e02b2c3d479';
      let commit;

      before(async () => {
        await subject.saveTermsResult(makeResult(), { trailers: { 'x-run-id': RUN_ID } });
        commit = await git.getCommit([]);
      });

      after(() => subject.removeAll());

      it('records the trailers on the commit', () => {
        expect(commit.trailers['x-run-id']).to.equal(RUN_ID);
      });
    });

    context('when the results carry undefined-valued declaration fields', () => { // Regression test: JSON.stringify drops undefined-valued keys at write time, so without normalisation the re-read form would differ from the in-memory one and produce a spurious DECLARATION_UPDATED on every run
      let saved;
      let commitsBefore;

      const sourceDocumentsWithUndefinedKeys = [{
        id: 'main',
        fetch: 'https://www.facebook.com/legal/terms',
        select: '.content',
        remove: undefined,
        filter: undefined,
        executeClientScripts: false,
        mimeType: 'text/html',
        snapshotId: 'def456',
      }];

      before(async () => {
        await subject.saveTermsResult(makeResult({ sourceDocuments: sourceDocumentsWithUndefinedKeys }));
        commitsBefore = (await git.log()).length;
        saved = await subject.saveTermsResult(makeResult({ sourceDocuments: sourceDocumentsWithUndefinedKeys, date: '2026-02-10T10:30:00Z' }));
      });

      after(() => subject.removeAll());

      it('detects no substantive change on an identical follow-up save', () => {
        expect(saved).to.deep.equal({ sha: null, eventType: null });
      });

      it('does not create a new commit', async () => {
        expect((await git.log()).length).to.equal(commitsBefore);
      });
    });

    context('when status transitions from ok to failed', () => {
      let commit;

      before(async () => {
        await subject.saveTermsResult(makeResult());
        await subject.saveTermsResult(makeResult({ status: STATUSES.failed, reasons: ['[fetch] HTTP 500'] }));
        ([commit] = await git.log());
      });

      after(() => subject.removeAll());

      it('uses the failure subject with the derived failure type', () => {
        expect(commit.message).to.equal('Record tracking failure of Facebook Terms of Service (fetch)');
      });
    });

    context('when status transitions from failed to ok', () => {
      let commit;

      before(async () => {
        await subject.saveTermsResult(makeResult({ status: STATUSES.failed, reasons: ['[fetch] HTTP 500'] }));
        await subject.saveTermsResult(makeResult());
        ([commit] = await git.log());
      });

      after(() => subject.removeAll());

      it('uses the recovery subject', () => {
        expect(commit.message).to.equal('Record tracking recovery of Facebook Terms of Service');
      });
    });

    context('when a transient error is introduced', () => {
      let commit;

      before(async () => {
        await subject.saveTermsResult(makeResult());
        await subject.saveTermsResult(makeResult({ transientError: { reasons: ['[fetch] HTTP 503'] } }));
        ([commit] = await git.log());
      });

      after(() => subject.removeAll());

      it('uses the transient-error subject', () => {
        expect(commit.message).to.equal('Record transient error of Facebook Terms of Service');
      });
    });

    context('when a transient error is then resolved', () => {
      let commit;

      before(async () => {
        await subject.saveTermsResult(makeResult());
        await subject.saveTermsResult(makeResult({ transientError: { reasons: ['[fetch] HTTP 503'] } }));
        await subject.saveTermsResult(makeResult());
        ([commit] = await git.log());
      });

      after(() => subject.removeAll());

      it('uses the clear-transient-error subject', () => {
        expect(commit.message).to.equal('Clear transient error of Facebook Terms of Service');
      });
    });

    context('when the declaration is updated', () => {
      let commit;

      before(async () => {
        await subject.saveTermsResult(makeResult({ sourceDocuments: [{ ...SOURCE_DOCUMENTS[0], select: '.old' }] }));
        await subject.saveTermsResult(makeResult({ sourceDocuments: [{ ...SOURCE_DOCUMENTS[0], select: '.new' }] }));
        ([commit] = await git.log());
      });

      after(() => subject.removeAll());

      it('uses the declaration-update subject', () => {
        expect(commit.message).to.equal('Update tracking declaration of Facebook Terms of Service');
      });
    });

    context('when only the MIME type changes', () => {
      let commit;

      before(async () => {
        await subject.saveTermsResult(makeResult({ sourceDocuments: [{ ...SOURCE_DOCUMENTS[0], mimeType: 'text/html' }] }));
        await subject.saveTermsResult(makeResult({ sourceDocuments: [{ ...SOURCE_DOCUMENTS[0], mimeType: 'application/pdf' }] }));
        ([commit] = await git.log());
      });

      after(() => subject.removeAll());

      it('uses the mime-type-update subject', () => {
        expect(commit.message).to.equal('Update MIME type of Facebook Terms of Service');
      });
    });

    context('when only the service name changes', () => {
      let commit;

      before(async () => {
        await subject.saveTermsResult(makeResult({ serviceName: 'Facebook' }));
        await subject.saveTermsResult(makeResult({ serviceName: 'Facebook Inc.' }));
        ([commit] = await git.log());
      });

      after(() => subject.removeAll());

      it('uses the service-name-update subject, keyed by the stable serviceId', () => {
        expect(commit.message).to.equal('Update service name of Facebook Terms of Service');
      });
    });
  });

  describe('#findLatestTermsResult', () => {
    context('when no result exists', () => {
      it('returns null', async () => {
        expect(await subject.findLatestTermsResult(SERVICE_ID, TERMS_TYPE)).to.be.null;
      });
    });

    context('when a result has been saved', () => {
      let result;

      before(async () => {
        await subject.saveTermsResult(makeResult());
        result = await subject.findLatestTermsResult(SERVICE_ID, TERMS_TYPE);
      });

      after(() => subject.removeAll());

      it('returns the persisted result as a TermsResult', () => {
        expect(result).to.be.instanceOf(TermsResult);
        expect(result.serviceId).to.equal(SERVICE_ID);
        expect(result.termsType).to.equal(TERMS_TYPE);
        expect(result.status).to.equal(STATUSES.ok);
        expect(result.event.serviceName).to.equal(SERVICE_NAME);
      });
    });
  });

  describe('#findAllTermsResults', () => {
    context('when nothing is saved', () => {
      it('returns an empty array', async () => {
        expect(await subject.findAllTermsResults()).to.deep.equal([]);
      });
    });

    context('when several services and terms are saved', () => {
      let results;

      before(async () => {
        await subject.saveTermsResult(makeResult({ serviceId: 'Facebook', termsType: 'Terms of Service' }));
        await subject.saveTermsResult(makeResult({ serviceId: 'Facebook', termsType: 'Privacy Policy' }));
        await subject.saveTermsResult(makeResult({ serviceId: 'Google', termsType: 'Terms of Service' }));
        results = await subject.findAllTermsResults();
      });

      after(() => subject.removeAll());

      it('returns one TermsResult per persisted file', () => {
        expect(results).to.have.length(3);
      });

      it('returns TermsResult instances with correct service and terms type identifiers', () => {
        const keys = results.map(r => `${r.serviceId}/${r.termsType}`).sort();

        expect(keys).to.deep.equal([ 'Facebook/Privacy Policy', 'Facebook/Terms of Service', 'Google/Terms of Service' ]);
      });
    });

    context('when a run.json sits at the root', () => {
      let results;

      before(async () => {
        await subject.saveRun(makeRun(), RUN_EVENT_TYPES.STARTED);
        await subject.saveTermsResult(makeResult());
        results = await subject.findAllTermsResults();
      });

      after(() => subject.removeAll());

      it('does not include run.json among the tracking results', () => {
        expect(results).to.have.length(1);
        expect(results[0].termsType).to.equal(TERMS_TYPE);
      });
    });

    context('when a service folder contains a corrupt JSON file', () => {
      before(async () => {
        await subject.saveTermsResult(makeResult({ serviceId: 'Facebook', termsType: 'Terms of Service' }));
        await fs.writeFile(path.join(REPOSITORY_PATH, 'Facebook', 'Privacy Policy.json'), '{ broken json'); // Corrupt file alongside valid one
      });

      after(() => subject.removeAll());

      it('throws an error rather than silently skipping', async () => {
        try {
          await subject.findAllTermsResults();
          expect.fail('expected findAllTermsResults to throw');
        } catch (error) {
          expect(error.message).to.match(/Could not parse JSON in/);
          expect(error.message).to.include('Privacy Policy.json');
        }
      });
    });
  });

  describe('#saveRun', () => {
    context('with RUN_STARTED', () => {
      let commit;

      before(async () => {
        await subject.saveRun(makeRun(), RUN_EVENT_TYPES.STARTED);
        ([commit] = await git.log());
      });

      after(() => subject.removeAll());

      it('creates a commit with the Start run subject', () => {
        expect(commit.message).to.equal('Start run ota-run-f47ac10b');
      });

      it('persists run.json at the root of the repository', () => {
        expect(fsApi.existsSync(path.join(REPOSITORY_PATH, 'run.json'))).to.be.true;
      });
    });

    context('called twice in a row with identical content', () => {
      let commitsBefore;
      let commitCount;
      let secondSha;

      before(async () => {
        await subject.saveRun(makeRun(), RUN_EVENT_TYPES.STARTED);
        commitsBefore = (await git.log()).length;
        secondSha = await subject.saveRun(makeRun(), RUN_EVENT_TYPES.STARTED); // Same content as the previous saveRun
        commitCount = (await git.log()).length;
      });

      after(() => subject.removeAll());

      it('attempts the commit but Git creates no new revision when the run.json content is byte-identical', () => {
        // saveRun does not proactively short-circuit like saveTermsResult does; Git's own "nothing to commit" guard is the last line of defense.
        expect(commitCount).to.equal(commitsBefore);
      });

      it('returns no SHA for the no-op commit attempt', () => {
        expect(secondSha).to.be.undefined;
      });
    });

    context('with RUN_COMPLETED', () => {
      let commit;

      before(async () => {
        const run = makeRun();

        run.markCompleted('2026-04-06T10:42:34Z');
        run.tracked = { ok: 1518, failed: 5 };
        await subject.saveRun(run, RUN_EVENT_TYPES.COMPLETED);
        ([commit] = await git.log());
      });

      after(() => subject.removeAll());

      it('creates a commit with counts in the subject', () => {
        expect(commit.message).to.equal('Complete run ota-run-f47ac10b (1518 ok, 5 failed)');
      });
    });

    context('with RUN_FINALIZED_CRASHED', () => {
      let commit;

      before(async () => {
        const run = makeRun();

        run.markCrashed('2026-04-06T10:42:34Z');
        await subject.saveRun(run, RUN_EVENT_TYPES.FINALIZED_CRASHED);
        ([commit] = await git.log());
      });

      after(() => subject.removeAll());

      it('creates a commit with the Finalize crashed run subject', () => {
        expect(commit.message).to.equal('Finalize crashed run ota-run-f47ac10b');
      });
    });
  });

  describe('#findLatestRun', () => {
    context('when no run.json exists', () => {
      it('returns null', async () => {
        expect(await subject.findLatestRun()).to.be.null;
      });
    });

    context('after a saveRun', () => {
      let run;

      before(async () => {
        await subject.saveRun(makeRun(), RUN_EVENT_TYPES.STARTED);
        run = await subject.findLatestRun();
      });

      after(() => subject.removeAll());

      it('returns the persisted run as a Run instance', () => {
        expect(run).to.be.instanceOf(Run);
        expect(run.runId).to.equal('ota-run-f47ac10b-58cc-4372-a567-0e02b2c3d479');
        expect(run.lastRun.status).to.equal('in_progress');
      });
    });

    context('when run.json is corrupt JSON', () => {
      before(async () => {
        await subject.saveRun(makeRun(), RUN_EVENT_TYPES.STARTED);
        await fs.writeFile(path.join(REPOSITORY_PATH, 'run.json'), '{ broken json');
      });

      after(() => subject.removeAll());

      it('throws an error contextualised with the file path', async () => {
        try {
          await subject.findLatestRun();
          expect.fail('expected findLatestRun to throw');
        } catch (error) {
          expect(error.message).to.match(/Could not parse JSON in/);
          expect(error.message).to.include('run.json');
        }
      });
    });
  });

  describe('#removeAll', () => {
    it('deletes all persisted files and leaves the repository in a valid empty state', async () => {
      await subject.saveTermsResult(makeResult());
      await subject.removeAll();
      expect(await subject.findAllTermsResults()).to.deep.equal([]);
    });

    it('is safe to call on an already-empty repository', async () => {
      await subject.removeAll(); // First call empties it
      let threw = false;

      try {
        await subject.removeAll(); // Second call on empty repo
      } catch {
        threw = true;
      }
      expect(threw).to.be.false;
    });
  });

  describe('#initialize', () => {
    it('is idempotent: calling it twice does not throw and leaves the repo usable', async () => {
      await subject.initialize();
      await subject.initialize();
      await subject.saveTermsResult(makeResult());
      expect(await subject.findAllTermsResults()).to.have.length(1);
      await subject.removeAll();
    });
  });

  describe('#finalize', () => {
    context('when publish is false', () => {
      it('does not throw', () => subject.finalize());
    });
  });

  describe('#findLatestRunCommitSha', () => {
    context('when no run.json exists yet', () => {
      it('returns null', async () => {
        expect(await subject.findLatestRunCommitSha()).to.be.null;
      });
    });

    context('after a single saveRun', () => {
      let savedSha;

      before(async () => {
        savedSha = await subject.saveRun(makeRun(), RUN_EVENT_TYPES.STARTED);
      });

      after(() => subject.removeAll());

      it('returns the SHA of that commit', async () => {
        expect(await subject.findLatestRunCommitSha()).to.equal(savedSha);
      });
    });

    context('after several saveRun calls', () => {
      let lastSha;

      before(async () => {
        await subject.saveRun(makeRun(), RUN_EVENT_TYPES.STARTED);

        const completed = makeRun();

        completed.markCompleted('2026-04-06T10:42:34Z');
        completed.tracked = { ok: 0, failed: 0 };
        lastSha = await subject.saveRun(completed, RUN_EVENT_TYPES.COMPLETED);
      });

      after(() => subject.removeAll());

      it('returns the SHA of the latest commit on run.json', async () => {
        expect(await subject.findLatestRunCommitSha()).to.equal(lastSha);
      });
    });

    context('when the latest activity is on a per-terms file rather than run.json', () => {
      let runSha;

      before(async () => {
        runSha = await subject.saveRun(makeRun(), RUN_EVENT_TYPES.STARTED);
        await subject.saveTermsResult(makeResult({ serviceId: 'Facebook', termsType: 'Terms of Service' }));
      });

      after(() => subject.removeAll());

      it('still returns the latest commit on run.json, ignoring intervening per-terms commits', async () => {
        expect(await subject.findLatestRunCommitSha()).to.equal(runSha);
      });
    });
  });

  describe('#findCommittedTermsResultsSince', () => {
    context('with a null sha argument', () => {
      it('returns an empty array', async () => {
        expect(await subject.findCommittedTermsResultsSince(null)).to.deep.equal([]);
      });
    });

    context('when no per-terms commits happened after the sha', () => {
      let runSha;

      before(async () => {
        runSha = await subject.saveRun(makeRun(), RUN_EVENT_TYPES.STARTED);
      });

      after(() => subject.removeAll());

      it('returns an empty array', async () => {
        expect(await subject.findCommittedTermsResultsSince(runSha)).to.deep.equal([]);
      });
    });

    context('when several distinct terms were committed after the sha', () => {
      let runSha;
      let results;

      before(async () => {
        runSha = await subject.saveRun(makeRun(), RUN_EVENT_TYPES.STARTED);
        await subject.saveTermsResult(makeResult({ serviceId: 'Facebook', termsType: 'Terms of Service' }));
        await subject.saveTermsResult(makeResult({ serviceId: 'Google', termsType: 'Privacy Policy' }));
        results = await subject.findCommittedTermsResultsSince(runSha);
      });

      after(() => subject.removeAll());

      it('returns each committed terms exactly once, with serviceId and termsType', () => {
        const keys = results.map(r => `${r.serviceId}/${r.termsType}`).sort();

        expect(keys).to.deep.equal([ 'Facebook/Terms of Service', 'Google/Privacy Policy' ]);
      });
    });

    context('when the same terms is committed multiple times since the sha', () => {
      let runSha;
      let results;

      before(async () => {
        runSha = await subject.saveRun(makeRun(), RUN_EVENT_TYPES.STARTED);
        await subject.saveTermsResult(makeResult({ serviceId: 'Facebook', termsType: 'Terms of Service' }));
        await subject.saveTermsResult(makeResult({ serviceId: 'Facebook', termsType: 'Terms of Service', status: STATUSES.failed, reasons: ['[fetch] HTTP 500'] }));
        results = await subject.findCommittedTermsResultsSince(runSha);
      });

      after(() => subject.removeAll());

      it('deduplicates to a single entry per terms', () => {
        expect(results).to.deep.equal([{ serviceId: 'Facebook', termsType: 'Terms of Service' }]);
      });
    });

    context('when run.json is committed in between', () => {
      let runSha;
      let results;

      before(async () => {
        runSha = await subject.saveRun(makeRun(), RUN_EVENT_TYPES.STARTED);
        await subject.saveTermsResult(makeResult({ serviceId: 'Facebook', termsType: 'Terms of Service' }));

        const completed = makeRun();

        completed.markCompleted('2026-04-06T10:42:34Z');
        completed.tracked = { ok: 1, failed: 0 };
        await subject.saveRun(completed, RUN_EVENT_TYPES.COMPLETED);

        results = await subject.findCommittedTermsResultsSince(runSha);
      });

      after(() => subject.removeAll());

      it('does not include run.json in the results', () => {
        expect(results).to.deep.equal([{ serviceId: 'Facebook', termsType: 'Terms of Service' }]);
      });
    });
  });

  describe('crash recovery scenario', () => { // End-to-end test of the primitives composed the way the recorder composes them
    let startedRun;

    before(async () => {
      startedRun = makeRun({ runId: Run.generateId() });
      await subject.saveRun(startedRun, RUN_EVENT_TYPES.STARTED);
      await subject.saveTermsResult(makeResult({ serviceId: 'Facebook', termsType: 'Terms of Service' }));
      await subject.saveTermsResult(makeResult({ serviceId: 'Facebook', termsType: 'Privacy Policy' }));
      // Simulated crash: no run-completion commit. run.json on disk still has status: in_progress.
    });

    after(() => subject.removeAll());

    it('exposes the in-progress run via findLatestRun', async () => {
      const found = await subject.findLatestRun();

      expect(found.lastRun.status).to.equal('in_progress');
      expect(found.runId).to.equal(startedRun.runId);
    });

    it('lists exactly the terms committed during the partial run', async () => {
      const sha = await subject.findLatestRunCommitSha();
      const committed = await subject.findCommittedTermsResultsSince(sha);
      const keys = committed.map(r => `${r.serviceId}/${r.termsType}`).sort();

      expect(keys).to.deep.equal([ 'Facebook/Privacy Policy', 'Facebook/Terms of Service' ]);
    });

    it('can be finalised additively by marking the run as crashed and saving it again', async () => {
      const found = await subject.findLatestRun();

      found.markCrashed('2026-04-06T11:00:00Z');
      found.coverage = {
        processed: 2,
        skipped: [{ serviceId: 'Google', termsType: 'Terms of Service', reason: 'engine crashed' }],
      };

      await subject.saveRun(found, RUN_EVENT_TYPES.FINALIZED_CRASHED);

      const refound = await subject.findLatestRun();

      expect(refound.lastRun.status).to.equal('crashed');
      expect(refound.lastRun.endDate).to.equal('2026-04-06T11:00:00Z');
      expect(refound.coverage.processed).to.equal(2);
      expect(refound.coverage.skipped).to.deep.equal([{ serviceId: 'Google', termsType: 'Terms of Service', reason: 'engine crashed' }]);
    });
  });
});
