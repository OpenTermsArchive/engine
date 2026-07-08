/**
 * Orchestrates a tracking run from a storage perspective: opens a run,
 * collects per-terms outcomes, aggregates the run-level counters and
 * transitions, and closes the run with a completed or crashed status.
 *
 * Lives one layer below the Archivist: callers feed plain
 * outcome payloads (no Service/Terms domain objects) and the recorder
 * builds and persists TermsResults and the Run on their behalf.
 */

import { UnreadableRunError } from './errors.js';
import { EVENT_TYPES as RUN_EVENT_TYPES } from './run/dataMapper.js';
import Run, { RUN_STATUSES } from './run/index.js';
import { TRANSITIONS_BY_EVENT_TYPE, termsKey } from './terms-result/dataMapper.js';
import TermsResult, { STATUSES } from './terms-result/index.js';

export { UnreadableRunError } from './errors.js';

export const RUN_ID_TRAILER_KEY = 'x-run-id'; // Git trailer tying every commit of a run to its runId, so run membership stays greppable without relying on commit ranges between two run.json commits; parseTrailers lowercases keys, hence the casing

export default class TrackingResultsRecorder {
  constructor({ repository, collectionId, schedule, engineVersion }) {
    this.repository = repository;
    this.collectionId = collectionId;
    this.schedule = schedule;
    this.engineVersion = engineVersion;
    this.currentRun = null;
    this.latestStatusPerTerms = new Map();
  }

  async initialize() {
    await this.repository.initialize();
  }

  finalize() { // Not async because nothing needs to be awaited before delegating, matching the Recorder.finalize pattern in the existing recorder module
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

    await this.repository.saveRun(run, RUN_EVENT_TYPES.STARTED, { trailers: runTrailers(run) });

    this.currentRun = run; // Assigned only once the run-start commit landed: a failed start must not leave a half-open run that later recordings would attach to
    this.latestStatusPerTerms.clear();

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

    run.coverage.processed++;

    if (event.transientError) {
      run.transientErrors++;
    }

    this.latestStatusPerTerms.set(termsKey(serviceId, termsType), status); // Tracks the latest status of each terms processed in this run, used by completeRun to compute tracked.ok/failed without a full repository scan

    const transitionType = TRANSITIONS_BY_EVENT_TYPE[eventType];

    if (transitionType) {
      run.recordTransition(transitionType, { serviceId, termsType });
    }
  }

  skipTerms({ serviceId, termsType, reason }) {
    this.activeRun.addSkipped({ serviceId, termsType, reason });
  }

  async completeRun() {
    const run = this.activeRun;

    // Counts are aggregated from the in-memory tracker populated by recordTermsOutcome.
    // Assumes every declared terms in this run was either passed to recordTermsOutcome or skipped via skipTerms; the Archivist is responsible for that invariant.
    let ok = 0;
    let failed = 0;

    for (const status of this.latestStatusPerTerms.values()) {
      if (status === STATUSES.ok) {
        ok++;
      } else if (status === STATUSES.failed) {
        failed++;
      }
    }

    run.tracked = { ok, failed };
    run.markCompleted(new Date().toISOString());

    await this.repository.saveRun(run, RUN_EVENT_TYPES.COMPLETED, { trailers: runTrailers(run) });

    this.currentRun = null;
    this.latestStatusPerTerms.clear();
  }

  async findInProgressRunForRecovery() {
    let previousRun;

    try {
      previousRun = await this.repository.findLatestRun();
    } catch (error) {
      throw new UnreadableRunError(error.message);
    }

    if (!previousRun || previousRun.lastRun.status !== RUN_STATUSES.inProgress) {
      return null;
    }

    const runStartSha = await this.repository.findLatestRunCommitSha();
    const committedTerms = await this.repository.findCommittedTermsResultsSince(runStartSha);

    return { run: previousRun, committedTerms };
  }

  async finalizeCrashedRun(run) {
    run.markCrashed(new Date().toISOString());
    await this.repository.saveRun(run, RUN_EVENT_TYPES.FINALIZED_CRASHED, { trailers: runTrailers(run) }); // Carries the crashed run's id, so the finalization commit is greppable alongside the run it closes
  }

  // Composes findInProgressRunForRecovery + finalizeCrashedRun into the full crash recovery flow.
  // The caller supplies a `getDeclaredTermsAtCommit(sha)` callback that returns the terms declared at the given declarations commit, since the recorder has no knowledge of the declarations module.
  // Must be invoked BEFORE startRun on a fresh engine boot: a new startRun would write a run-start commit on run.json and hide the previous in-progress run's reference SHA from findLatestRunCommitSha.
  async recoverCrashedRunIfAny({ getDeclaredTermsAtCommit }) {
    const recovery = await this.findInProgressRunForRecovery();

    if (!recovery) {
      return null;
    }

    const { run, committedTerms } = recovery;
    const committedKeys = new Set(committedTerms.map(t => termsKey(t.serviceId, t.termsType)));
    const persistedSkipped = run.coverage?.skipped ?? []; // Skips persisted by the run-start commit (e.g. terms not selected by a partial run) are preserved with their original reason, not re-attributed to the crash
    const skippedKeys = new Set(persistedSkipped.map(t => termsKey(t.serviceId, t.termsType)));
    const declaredTerms = await getDeclaredTermsAtCommit(run.declarations.commit);
    const crashSkipped = declaredTerms
      .filter(t => !committedKeys.has(termsKey(t.serviceId, t.termsType)) && !skippedKeys.has(termsKey(t.serviceId, t.termsType)))
      .map(t => ({ serviceId: t.serviceId, termsType: t.termsType, reason: 'engine crashed' }));

    run.coverage = { processed: committedTerms.length, skipped: [ ...persistedSkipped, ...crashSkipped ] };
    run.tracked = await this.deriveTrackedCounts(committedTerms);
    // run.transitions is left as persisted by the run-start commit (empty): deriving it back would mean parsing commit subjects, and the transitions of a crashed run remain derivable by consumers from its per-terms commits
    await this.finalizeCrashedRun(run);

    return run;
  }

  async deriveTrackedCounts(committedTerms) { // The committed terms files still hold the crashed run's last written state, since recovery runs before any new startRun
    const counts = { ok: 0, failed: 0 };

    for (const { serviceId, termsType } of committedTerms) {
      const result = await this.repository.findLatestTermsResult(serviceId, termsType);

      if (result) { // Defensive: a file removed by hand since the crash leaves the counts unchanged rather than failing the recovery
        counts[result.status]++;
      }
    }

    return counts;
  }

  discardCurrentRun() { // Explicit reset; preferred over poking at currentRun directly so callers (and tests) do not need to know the internal field
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
