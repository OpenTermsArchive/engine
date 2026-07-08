import events from 'events';
import { createRequire } from 'module';

import config from 'config';
import mime from 'mime';

import { GitObjectNotFoundError } from '../../git/index.js';
import { getCollection } from '../collection/index.js';
import { ExtractDocumentError } from '../extract/index.js';
import { FetchDocumentError } from '../fetcher/index.js';
import * as declaredServices from '../services/index.js';
import Service from '../services/service.js';

import { MissingCollectionIdError, UnreadableRunError } from './errors.js';
import TrackingResultsRecorder from './recorder.js';
import TrackingResultsRepository from './repository.js';
import { STATUSES } from './terms-result/index.js';

export { MissingCollectionIdError } from './errors.js';

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION } = require('../../../package.json');

export default class TrackingResults extends events.EventEmitter {
  static async create(trackingResultsConfig) { // Resolves the engine-side wiring (collection identity, schedule, engine version) so the caller does not need to know it
    if (trackingResultsConfig.storage.type !== 'git') { // Git is the only supported backend, as the audit trail relies on its tamper-evident properties
      throw new Error(`Unsupported tracking-results storage type "${trackingResultsConfig.storage.type}"; only "git" is supported`);
    }

    const collection = await getCollection();
    const collectionId = collection.metadata?.id; // getCollection always resolves to a Collection instance; metadata stays undefined when the metadata file is absent, which is exactly the missing-id case reported below

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
    this.ready = false;
  }

  async initialize() {
    await this.ensureReady(); // Attempted as early as possible so readers of the repository see the previous run finalized without waiting for the next tracking run
  }

  async finalize() {
    if (!this.ready) { // Nothing was recorded, and the repository may not even be initialized
      return;
    }

    try {
      await this.recorder.finalize();
    } catch (error) {
      this.emit('warn', { message: `Could not finalize the tracking-results repository: ${error.message}; recorded commits are kept locally and the finalization will be retried at the next run` }); // Everything is already committed locally, so a failed push or commit-graph update loses nothing: the next successful finalize pushes all accumulated commits
    }
  }

  get hasRunInProgress() {
    return Boolean(this.recorder.currentRun);
  }

  async getDeclarationsCommit() { // Meant to be called right before the declarations are loaded, so that the commit identifies the declarations applied by every run of this process, whatever happens to their repository afterwards
    try {
      const declarationsCommit = await declaredServices.getDeclarationsCommit();

      if (!declarationsCommit) { // The audit trail premise (tamper-evident declarations commit) cannot be honoured
        this.emit('warn', { message: 'The declarations directory is not a Git repository; tracking-results runs will not be recorded' });
      }

      return declarationsCommit;
    } catch (error) { // An actual git failure, distinct from "declarations is not a Git repository" which is reported as null
      this.emit('warn', { message: `Could not read the declarations commit: ${error.message}; tracking-results runs will not be recorded` });

      return null;
    }
  }

  async startRun({ services, declarationsCommit, selectedServicesIds, selectedTermsTypes }) {
    if (!await this.ensureReady()) { // A new Start run commit would hide the crashed run's reference SHA and make its recovery impossible forever
      return;
    }

    if (!declarationsCommit) { // Already reported by getDeclarationsCommit
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
    if (!this.hasRunInProgress) { // No tracking-results run is active (technical upgrades, run start skipped or failed); nothing to record
      return;
    }

    await this.recorder.recordTermsOutcome({
      serviceId: terms.service.id,
      termsType: terms.type,
      serviceName: terms.service.name,
      sourceDocuments: terms.sourceDocuments.map(sourceDocument => ({
        id: sourceDocument.id,
        ...sourceDocument.toPersistence(),
        mimeType: normalizeMimeType(sourceDocument.mimeType),
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

  async ensureReady() { // Returns true when it is safe to write a new run-start commit: the repository is initialized and a pending in_progress run.json has been finalized. Success is memoised, and a failure is retried at the next call so a long-lived scheduled process self-heals without a restart
    if (this.ready) {
      return true;
    }

    try {
      await this.recorder.initialize(); // Repeated at each attempt, as it also drops what a failed attempt may have left uncommitted

      const recovered = await this.recorder.recoverCrashedRunIfAny({ getDeclaredTermsAtCommit: commit => this.declaredTermsAtCommit(commit) });

      this.ready = true;

      if (recovered) {
        this.emit('warn', { message: `Recovered crashed run ${recovered.shortRunId}: persisted ${recovered.coverage.processed} processed terms and ${recovered.coverage.skipped.length} skipped terms before the new run starts` });
      }

      return true;
    } catch (error) {
      if (error instanceof UnreadableRunError) { // A stale or incompatible run.json cannot be recovered by construction: proceed, the next startRun will overwrite it with a valid one
        this.ready = true;
        this.emit('warn', { message: `Could not read previous tracking-results state: ${error.message}. The previous run.json may be from an incompatible engine version; it will be overwritten by the next run.` });

        return true;
      }

      this.emit('warn', { message: `Could not prepare the tracking-results repository: ${error.message}; tracking-results is disabled for this run and the preparation will be retried at the next one` }); // An auxiliary audit trail must not prevent tracking itself, be it at initialization

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

function normalizeMimeType(mimeType) { // Fetchers report the raw Content-Type header while Git snapshots report the type derived from their file extension; aligned on the latter, so that a parameter or an alias is not recorded as a MIME type change
  if (!mimeType) {
    return null;
  }

  return mime.getType(mime.getExtension(mimeType) || '') || mimeType.split(';')[0].trim().toLowerCase();
}

function categorizeReasons(errors) { // Tags each reason with [fetch], [extraction] or [internal] so that commit subjects and consumers of the persisted reasons can split by category without sniffing error types
  return errors.map(error => {
    if (error instanceof FetchDocumentError) {
      return `[fetch] ${error.message}`;
    }

    if (error instanceof ExtractDocumentError) {
      return `[extraction] ${error.message}`;
    }

    return '[internal] Unexpected engine error'; // The message of an unexpected error may expose server paths or git output, which must not enter a published history that cannot be rewritten; the details are in the logs
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
