/**
 * Maps between Run domain objects and their persisted shape (run.json)
 */

import Run from './index.js';

export const EVENT_TYPES = Object.freeze({
  STARTED: 'started',
  COMPLETED: 'completed',
  FINALIZED_CRASHED: 'finalizedCrashed',
});

export const FILE_NAME = 'run.json';

export function toPersistence(run, eventType) {
  return {
    message: formatMessage(eventType, run),
    content: `${JSON.stringify(toJSON(run), null, 2)}\n`,
    filePath: FILE_NAME,
    date: run.lastRun.endDate || run.lastRun.startDate,
  };
}

export function toDomain(data) {
  const run = new Run({
    runId: data?.runId,
    collectionId: data?.collectionId,
    schedule: data?.schedule,
    startDate: data?.lastRun?.startDate,
    engineVersion: data?.lastRun?.engineVersion,
    declarationsCommit: data?.declarations?.commit,
    servicesCount: data?.declarations?.services,
    termsCount: data?.declarations?.terms,
  });

  // Fields beyond the initial construction shape are restored directly: the persisted run captures state accumulated through the run's lifecycle (markCompleted/markCrashed, addSkipped, recordTransition, tracked counters).
  if (data?.lastRun) {
    run.lastRun.endDate = data.lastRun.endDate;
    run.lastRun.status = data.lastRun.status;
  }

  if (data?.tracked) {
    run.tracked = data.tracked;
  }

  if (data?.coverage) {
    run.coverage = data.coverage;
  }

  if (data?.transitions) {
    run.transitions = data.transitions;
  }

  if (data?.transientErrors !== undefined) {
    run.transientErrors = data.transientErrors;
  }

  try {
    run.validate();
  } catch (error) {
    throw new Error(`Invalid run content: ${error.message}`);
  }

  return run;
}

export function formatMessage(eventType, run) {
  switch (eventType) {
  case EVENT_TYPES.STARTED:
    return `Start run ${run.shortRunId}`;
  case EVENT_TYPES.COMPLETED:
    return `Complete run ${run.shortRunId} (${run.tracked.ok} ok, ${run.tracked.failed} failed)`;
  case EVENT_TYPES.FINALIZED_CRASHED:
    return `Finalize crashed run ${run.shortRunId}`;
  default:
    throw new Error(`Unknown run event type: "${eventType}"`);
  }
}

function toJSON(run) {
  return {
    runId: run.runId,
    collectionId: run.collectionId,
    schedule: run.schedule,
    lastRun: run.lastRun,
    declarations: run.declarations,
    tracked: run.tracked,
    coverage: run.coverage,
    transitions: run.transitions,
    transientErrors: run.transientErrors,
  };
}
