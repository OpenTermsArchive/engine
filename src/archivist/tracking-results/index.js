/**
 * Engine-facing entry point of the tracking-results module.
 *
 * Translates the Archivist's tracking lifecycle and domain objects into
 * recorder operations, and owns the run lifecycle policy: crash recovery
 * gating, declarations commit resolution, coverage of partial runs and
 * categorisation of failure reasons. The recorder below stays free of any
 * knowledge of declarations, services or configuration.
 *
 * Emits `warn` events instead of logging for conditions that degrade
 * tracking-results without stopping the tracking itself; the Archivist
 * relays them on the engine's public event surface.
 */

import events from 'events';
import { createRequire } from 'module';
import path from 'path';

import config from 'config';

import { GitObjectNotFoundError } from '../../git/errors.js';
import Git from '../../git/index.js';
import { getCollection } from '../collection/index.js';
import { ExtractDocumentError } from '../extract/index.js';
import { FetchDocumentError } from '../fetcher/index.js';
import * as declaredServices from '../services/index.js';
import Service from '../services/service.js';

import { MissingCollectionIdError, UnreadableRunError } from './errors.js';
import TrackingResultsRecorder from './recorder.js';
import TrackingResultsRepository from './repository.js';
import { STATUSES } from './terms-result/index.js';

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION } = require('../../../package.json');

export default class TrackingResults extends events.EventEmitter {
  static async create(trackingResultsConfig) { // Resolves the engine-side wiring (collection identity, schedule, engine version) so the caller does not need to know it
    const collection = await getCollection();
    const collectionId = collection?.metadata?.id;

    if (!collectionId) {
      throw new MissingCollectionIdError('Collection metadata "id" is required to record tracking-results, as it identifies the collection in every persisted run. Add an "id" field to the collection metadata file.');
    }

    const repository = new TrackingResultsRepository(trackingResultsConfig.storage.git);
    const recorder = new TrackingResultsRecorder({
      repository,
      collectionId,
      schedule: config.get('@opentermsarchive/engine.trackingSchedule'),
      engineVersion: PACKAGE_VERSION,
    });

    return new TrackingResults({ recorder });
  }

  constructor({ recorder }) {
    super();
    this.recorder = recorder;
    this.crashedRunRecovered = false;
  }

  async initialize() {
    await this.recorder.initialize();
    await this.ensureCrashedRunRecovered(); // Attempted as early as possible so readers of the repository see the previous run finalized without waiting for the next tracking run
  }

  async finalize() {
    try {
      await this.recorder.finalize();
    } catch (error) {
      this.emit('warn', { message: `Could not finalize the tracking-results repository: ${error.message}; recorded commits remain local and will be pushed at the next run` }); // Everything is already committed locally, so a push failure loses nothing: the next successful finalize pushes all accumulated commits
    }
  }

  get hasRunInProgress() {
    return Boolean(this.recorder.currentRun);
  }

  async startRun({ services, selectedServicesIds, selectedTermsTypes }) {
    if (!await this.ensureCrashedRunRecovered()) { // A new Start run commit would hide the crashed run's reference SHA and make its recovery impossible forever
      return;
    }

    const declarationsPath = path.resolve(process.cwd(), config.get('@opentermsarchive/engine.collectionPath'), declaredServices.DECLARATIONS_PATH);
    let declarationsCommit = null;
    let declarationsCommitError = null;

    try {
      declarationsCommit = await Git.getHeadSha(declarationsPath);
    } catch (error) {
      declarationsCommitError = error; // An actual git failure, distinct from "declarations is not a Git repository" which getHeadSha reports as null
    }

    if (!declarationsCommit) {
      if (declarationsCommitError) {
        this.emit('warn', { message: `Could not read the declarations commit at ${declarationsPath}: ${declarationsCommitError.message}; tracking-results is disabled for this run` });
      } else { // Declarations is not a Git repository (e.g. in test fixtures); skip tracking-results for this run since the audit trail premise (tamper-evident declarations commit) cannot be honoured
        this.emit('warn', { message: `Declarations directory at ${declarationsPath} is not a Git repository; tracking-results is disabled for this run` });
      }

      return;
    }

    const servicesIds = Object.keys(services).sort((a, b) => a.localeCompare(b)); // Sorted so the persisted skipped list is deterministic

    try {
      await this.recorder.startRun({
        declarationsCommit,
        servicesCount: servicesIds.length, // Declared counts always cover the full declarations, whatever subset this run processes; coverage.skipped carries the difference so the coverage proof (declared = processed + skipped) stays derivable
        termsCount: Service.getNumberOfTerms(services, servicesIds, []),
        skippedTerms: unselectedTerms(services, servicesIds, { selectedServicesIds, selectedTermsTypes }),
      });
    } catch (error) {
      this.emit('warn', { message: `Could not start the tracking-results run: ${error.message}; tracking-results is disabled for this run` }); // Like every other tracking-results failure, a failed run-start commit degrades the audit trail, never the tracking itself
    }
  }

  recordSuccess(terms, { transientErrors } = {}) {
    return this.record(terms, { status: STATUSES.ok, transientErrorReasons: transientErrors?.length ? categorizeReasons(transientErrors) : undefined });
  }

  recordFailure(terms, errors) {
    return this.record(terms, { status: STATUSES.failed, reasons: categorizeReasons(errors) });
  }

  async record(terms, { status, reasons, transientErrorReasons }) {
    if (!this.hasRunInProgress) { // No tracking-results run is active (e.g. startRun was skipped because declarations is not a Git repository); nothing to record
      return;
    }

    await this.recorder.recordTermsOutcome({
      serviceId: terms.service.id,
      termsType: terms.type,
      serviceName: terms.service.name,
      sourceDocuments: terms.sourceDocuments.map(sourceDocument => ({
        id: sourceDocument.id,
        ...sourceDocument.toPersistence(),
        mimeType: sourceDocument.mimeType ?? null,
        snapshotId: sourceDocument.snapshotId ?? null,
      })),
      status,
      reasons,
      transientErrorReasons,
    });
  }

  completeRun() {
    return this.recorder.completeRun();
  }

  // Returns true when it is safe to write a new run-start commit. A pending in_progress run.json must be finalized first; success is memoised, and a failure is retried at the next call so a long-lived scheduled process self-heals without a restart.
  async ensureCrashedRunRecovered() {
    if (this.crashedRunRecovered) {
      return true;
    }

    try {
      const recovered = await this.recorder.recoverCrashedRunIfAny({ getDeclaredTermsAtCommit: commit => this.declaredTermsAtCommit(commit) });

      this.crashedRunRecovered = true;

      if (recovered) {
        this.emit('warn', { message: `Recovered crashed run ${recovered.shortRunId}: persisted ${recovered.coverage.processed} processed terms and ${recovered.coverage.skipped.length} skipped terms before the new run starts` });
      }

      return true;
    } catch (error) {
      if (error instanceof UnreadableRunError) { // A stale or incompatible run.json cannot be recovered by construction: proceed, the next startRun will overwrite it with a valid one
        this.crashedRunRecovered = true;
        this.emit('warn', { message: `Could not read previous tracking-results state: ${error.message}. The previous run.json may be from an incompatible engine version; it will be overwritten by the next run.` });

        return true;
      }

      this.emit('warn', { message: `Could not recover the previous tracking-results run: ${error.message}; tracking-results is disabled for this run and recovery will be retried at the next one` });

      return false;
    }
  }

  async declaredTermsAtCommit(commit) {
    try {
      return await declaredServices.getDeclaredTermsAtCommit(commit);
    } catch (error) {
      if (error instanceof GitObjectNotFoundError) { // The commit is unreachable forever (shallow clone, rewritten declarations history): fall back to the currently declared terms so the crashed run can still be finalized, and surface the approximation
        this.emit('warn', { message: `Declarations commit ${commit} is not reachable; crash recovery coverage falls back to the currently declared terms` });

        return declaredServices.getDeclaredTerms();
      }

      throw error;
    }
  }
}

function categorizeReasons(errors) { // Prefixes each error message with a [fetch], [extraction] or [internal] tag so consumers (commit messages, transitions, analytics) can split by category without sniffing error types
  return errors.map(error => {
    if (error instanceof FetchDocumentError) {
      return `[fetch] ${error.message}`;
    }

    if (error instanceof ExtractDocumentError) {
      return `[extraction] ${error.message}`;
    }

    return `[internal] ${error.message}`;
  });
}

function unselectedTerms(services, servicesIds, { selectedServicesIds, selectedTermsTypes }) { // Enumerates the declared terms that this run will not process, so partial runs (CLI-filtered services or terms types) record them as explicitly skipped
  const skipped = [];

  for (const serviceId of servicesIds) {
    const selectedTypes = new Set(selectedServicesIds.includes(serviceId) ? services[serviceId].getTermsTypes(selectedTermsTypes) : []);

    for (const termsType of services[serviceId].getTermsTypes()) {
      if (!selectedTypes.has(termsType)) {
        skipped.push({ serviceId, termsType, reason: 'not selected for this run' });
      }
    }
  }

  return skipped;
}
