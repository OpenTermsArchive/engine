import Run, { RUN_STATUSES } from './index.js';

export const FILE_NAME = 'run.json';

export function toPersistence(run) {
  return {
    message: formatMessage(run),
    content: `${JSON.stringify(toJSON(run), null, 2)}\n`,
    filePath: FILE_NAME,
    date: run.lastRun.endDate || run.lastRun.startDate,
  };
}

export function toDomain(data) {
  try {
    const run = Object.assign(new Run(), data); // The persisted shape is the in-memory shape, so every field accumulated through the run's lifecycle is restored as is

    run.validate();

    return run;
  } catch (error) {
    throw new Error(`Invalid run content: ${error.message}`);
  }
}

export function formatMessage(run) { // The status of the run tells which step of its lifecycle is being committed
  switch (run.lastRun.status) {
  case RUN_STATUSES.inProgress:
    return `Start run ${run.shortRunId}`;
  case RUN_STATUSES.completed:
    return `Complete run ${run.shortRunId} (${run.tracked.ok} ok, ${run.tracked.failed} failed)`;
  case RUN_STATUSES.crashed:
    return `Finalize crashed run ${run.shortRunId}`;
  default:
    throw new Error(`Unknown run status: "${run.lastRun.status}"`);
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
