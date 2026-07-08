import { UnreadableRunError } from './errors.js';
import Run, { RUN_STATUSES } from './run/index.js';
import { TRANSITIONS_BY_EVENT_TYPE, termsKey } from './terms-result/dataMapper.js';
import TermsResult, { STATUSES } from './terms-result/index.js';

export const RUN_ID_TRAILER_KEY = 'x-run-id'; // Git trailer tying every commit of a run to its runId, so run membership stays greppable without relying on commit ranges between two run.json commits; parseTrailers lowercases keys, hence the casing

export default class TrackingResultsRecorder {
  constructor({ repository, collectionId, schedule, engineVersion }) {
    this.repository = repository;
    this.collectionId = collectionId;
    this.schedule = schedule;
    this.engineVersion = engineVersion;
    this.currentRun = null;
  }

  async initialize() {
    await this.repository.initialize();
  }

  finalize() {
    return this.repository.finalize();
  }

  async startRun({ declarationsCommit, servicesCount, termsCount, skippedTerms = [] }) {
    const run = new Run({
      runId: Run.generateId(),
      collectionId: this.collectionId,
      schedule: this.schedule,
      startDate: new Date().toISOString(),
      engineVersion: this.engineVersion,
      declarationsCommit,
      servicesCount,
      termsCount,
    });

    skippedTerms.forEach(skipped => run.addSkipped(skipped)); // Skips known at run start (e.g. terms not selected by a partial run) are persisted in the run-start commit: a crash during the run must not let recovery attribute them to the crash

    await this.repository.saveRun(run, { trailers: runTrailers(run) });

    this.currentRun = run; // Assigned only once the run-start commit landed: a failed start must not leave a half-open run that later recordings would attach to

    return run;
  }

  async recordTermsOutcome({ serviceId, termsType, serviceName, sourceDocuments, status, reasons, transientErrorReasons }) {
    const run = this.activeRun;

    const event = {
      date: new Date().toISOString(),
      serviceName,
      sourceDocuments,
    };

    if (status === STATUSES.failed) {
      event.reasons = reasons;
    }

    if (transientErrorReasons?.length) {
      event.transientError = { reasons: transientErrorReasons };
    }

    const newResult = new TermsResult({ serviceId, termsType, status, event });
    const { eventType } = await this.repository.saveTermsResult(newResult, { trailers: runTrailers(run) });

    run.coverage.processed++; // Counted per call: every terms of a run is either recorded once or persisted as skipped at run start; the Archivist is responsible for that invariant
    run.tracked[status]++;

    if (event.transientError) {
      run.transientErrors++;
    }

    const transitionType = TRANSITIONS_BY_EVENT_TYPE[eventType];

    if (transitionType) {
      run.recordTransition(transitionType, { serviceId, termsType });
    }
  }

  async completeRun() {
    const run = this.activeRun;

    run.markCompleted(new Date().toISOString());

    await this.repository.saveRun(run, { trailers: runTrailers(run) });

    this.currentRun = null;
  }

  async recoverCrashedRunIfAny({ getDeclaredTermsAtCommit }) { // Must be invoked before startRun: a new run-start commit would hide the crashed run's reference SHA from findLatestRunCommitSha. The callback returns the terms declared at a given declarations commit, since the recorder has no knowledge of the declarations module
    let run;

    try {
      run = await this.repository.findLatestRun();
    } catch (error) {
      throw error.code ? error : new UnreadableRunError(error.message, { cause: error }); // System errors carry a code and are worth a retry, unlike a content that cannot be parsed or validated
    }

    if (!run || run.lastRun.status !== RUN_STATUSES.inProgress) {
      return null;
    }

    const runStartSha = await this.repository.findLatestRunCommitSha();
    const committedTerms = await this.repository.findCommittedTermsResultsSince(runStartSha);
    const persistedSkipped = run.coverage.skipped; // Skips persisted by the run-start commit (e.g. terms not selected by a partial run) are preserved with their original reason, not re-attributed to the crash
    const accountedKeys = new Set([ ...committedTerms, ...persistedSkipped ].map(({ serviceId, termsType }) => termsKey(serviceId, termsType)));
    const declaredTerms = await getDeclaredTermsAtCommit(run.declarations.commit);
    const crashSkipped = declaredTerms
      .filter(({ serviceId, termsType }) => !accountedKeys.has(termsKey(serviceId, termsType)))
      .map(({ serviceId, termsType }) => ({ serviceId, termsType, reason: 'engine crashed' }));

    run.coverage = { processed: committedTerms.length, skipped: [ ...persistedSkipped, ...crashSkipped ] };
    ({ tracked: run.tracked, transientErrors: run.transientErrors } = await this.deriveCounts(committedTerms));
    run.markCrashed(new Date().toISOString()); // run.transitions is left as persisted by the run-start commit (empty): deriving it back would mean parsing commit subjects, and the transitions of a crashed run remain derivable by consumers from its per-terms commits
    await this.repository.saveRun(run, { trailers: runTrailers(run) }); // Carries the crashed run's id, so the finalization commit is greppable alongside the run it closes

    return run;
  }

  async deriveCounts(committedTerms) { // The committed terms files still hold the crashed run's last written state, since recovery runs before any new startRun
    const tracked = { ok: 0, failed: 0 };
    let transientErrors = 0;

    for (const { serviceId, termsType } of committedTerms) {
      const result = await this.repository.findLatestTermsResult(serviceId, termsType);

      if (!result) { // Defensive: a file removed by hand since the crash leaves the counts unchanged rather than failing the recovery
        continue;
      }

      tracked[result.status]++;

      if (result.event.transientError) {
        transientErrors++;
      }
    }

    return { tracked, transientErrors };
  }

  discardCurrentRun() { // Test entry point to drop the run in progress without persisting anything
    this.currentRun = null;
  }

  get activeRun() { // Single guarded access path to the run in progress: dereferencing it before startRun throws, so no mutating method needs a separate assertion. External readers keep using the nullable currentRun property
    if (!this.currentRun) {
      throw new Error(`${this.constructor.name}: no tracking run in progress; call startRun first`);
    }

    return this.currentRun;
  }
}

function runTrailers(run) {
  return { [RUN_ID_TRAILER_KEY]: run.runId };
}
