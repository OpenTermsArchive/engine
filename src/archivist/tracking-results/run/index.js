/**
 * Aggregate state of a tracking run, persisted as `run.json` at the root
 * of the tracking-results repository
 */

import { randomUUID } from 'crypto';

export const RUN_STATUSES = Object.freeze({
  inProgress: 'in_progress',
  completed: 'completed',
  crashed: 'crashed',
});

export const RUN_ID_PREFIX = 'ota-run-'; // Disambiguates from Git short SHAs and tags run IDs uniquely across logs and Git trailers
const RUN_ID_REGEXP = /^ota-run-([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const VALID_STATUSES = Object.freeze(Object.values(RUN_STATUSES));
const VALID_TRANSITION_TYPES = Object.freeze([ 'newFailures', 'recoveries', 'reasonChanges' ]);

export default class Run {
  static generateId() { // Single entry point for producing well-formed runIds; never compose the prefix and a UUID by hand at the call site
    return `${RUN_ID_PREFIX}${randomUUID()}`;
  }

  constructor({
    runId,
    collectionId,
    schedule,
    startDate,
    engineVersion,
    declarationsCommit,
    servicesCount,
    termsCount,
  } = {}) {
    this.runId = runId;
    this.collectionId = collectionId;
    this.schedule = schedule ?? null;
    this.lastRun = {
      startDate,
      endDate: null,
      engineVersion,
      status: RUN_STATUSES.inProgress,
    };
    this.declarations = {
      commit: declarationsCommit,
      services: servicesCount,
      terms: termsCount,
    };
    this.tracked = { ok: 0, failed: 0 };
    this.coverage = { processed: 0, skipped: [] };
    this.transitions = { newFailures: [], recoveries: [], reasonChanges: [] };
    this.transientErrors = 0;
  }

  get shortRunId() {
    return `${RUN_ID_PREFIX}${runIdMatch(this.runId)[1]}`; // Keeps the `ota-run-` prefix so the short form remains unmistakable against a Git short SHA
  }

  markCompleted(endDate) {
    this.lastRun.endDate = endDate;
    this.lastRun.status = RUN_STATUSES.completed;
  }

  markCrashed(endDate) {
    this.lastRun.endDate = endDate;
    this.lastRun.status = RUN_STATUSES.crashed;
  }

  addSkipped({ serviceId, termsType, reason }) {
    this.coverage.skipped.push({ serviceId, termsType, reason });
  }

  recordTransition(type, { serviceId, termsType }) {
    if (!VALID_TRANSITION_TYPES.includes(type)) {
      throw new Error(`${this.constructor.name}: invalid transition type "${type}"; must be one of "${VALID_TRANSITION_TYPES.join('", "')}"`);
    }

    this.transitions[type].push({ serviceId, termsType });
  }

  validate() {
    const requiredParams = { // Keyed by constructor param names, as callers provide them, even for the values stored under sub-objects; optional chaining so a missing sub-object reports its field as missing instead of crashing the validation
      runId: this.runId,
      collectionId: this.collectionId,
      startDate: this.lastRun?.startDate,
      engineVersion: this.lastRun?.engineVersion,
      declarationsCommit: this.declarations?.commit,
    };

    for (const [ requiredParam, value ] of Object.entries(requiredParams)) {
      if (value == null) {
        throw new Error(`${this.constructor.name} is not valid; "${requiredParam}" is missing`);
      }
    }

    if (!VALID_STATUSES.includes(this.lastRun.status)) {
      throw new Error(`${this.constructor.name} is not valid; "lastRun.status" must be one of "${VALID_STATUSES.join('", "')}", got "${this.lastRun.status}"`);
    }

    try {
      runIdMatch(this.runId); // Single source of truth for the runId format check, reused by shortRunId
    } catch (error) {
      throw new Error(`${this.constructor.name} is not valid; ${error.message}`);
    }
  }
}

function runIdMatch(runId) {
  const match = RUN_ID_REGEXP.exec(runId);

  if (!match) {
    throw new Error(`Invalid runId "${runId}"; expected format "ota-run-<uuid>"`);
  }

  return match;
}
