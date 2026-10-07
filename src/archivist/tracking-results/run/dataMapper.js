import Run, { RUN_STATUSES } from './index.js';

export const FILE_NAME = 'run.json';
export const COMPLETED_RUN_MESSAGE_PREFIX = 'Complete run '; // Shared with readers, which find the latest completed run by the subject of its commit
export const RUN_ID_TRAILER_KEY = 'x-run-id'; // Git trailer tying every commit of a run to its runId, so run membership stays greppable without relying on commit ranges between two run.json commits; parseTrailers lowercases keys, hence the casing. Shared with readers, which identify the completed run by the trailer of its completion commit

export function toPersistence(run) {
  return {
    message: formatMessage(run),
    content: `${JSON.stringify(toJSON(run), null, 2)}\n`,
    filePath: FILE_NAME,
    date: run.lastRun.endDate || run.lastRun.startDate,
    trailers: { [RUN_ID_TRAILER_KEY]: run.runId }, // Every commit of the run file identifies its run, so that readers can tell which run a completion commit closes without reading the file
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
    return `${COMPLETED_RUN_MESSAGE_PREFIX}${run.shortRunId} (${run.tracked.ok} ok, ${run.tracked.failed} failed)`;
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
