/**
 * Maps between TermsResult domain objects and their persisted shape
 */

import { isDeepStrictEqual } from 'util';

import { isPlainPathSegment } from '../../../git/pathSegment.js';

import TermsResult, { STATUSES } from './index.js';

export const EVENT_TYPES = Object.freeze({
  FIRST_TRACKING: 'firstTracking',
  TRACKING_FAILURE: 'trackingFailure',
  TRACKING_RECOVERY: 'trackingRecovery',
  REASONS_CHANGED: 'reasonsChanged',
  TRANSIENT_ERROR_DETECTED: 'transientErrorDetected',
  TRANSIENT_ERROR_RESOLVED: 'transientErrorResolved',
  DECLARATION_UPDATED: 'declarationUpdated',
  SERVICE_NAME_UPDATED: 'serviceNameUpdated',
  MIME_TYPE_UPDATED: 'mimeTypeUpdated',
});

// Run-level transition fed by each event type, colocated with EVENT_TYPES so a new substantive-change category decides here whether it is a transition; Run.recordTransition validates the values at runtime.
// FIRST_TRACKING (initial appearance) and the declaration, MIME type and service-name updates are deliberately not transitions: only true transitions between runs of the same terms feed run.transitions.
export const TRANSITIONS_BY_EVENT_TYPE = Object.freeze({
  [EVENT_TYPES.TRACKING_FAILURE]: 'newFailures',
  [EVENT_TYPES.TRACKING_RECOVERY]: 'recoveries',
  [EVENT_TYPES.REASONS_CHANGED]: 'reasonChanges',
});

const FAILURE_TYPE_PRIORITY = Object.freeze([ 'fetch', 'extraction', 'internal' ]);

export function termsKey(serviceId, termsType) { // Canonical composite identifier of a service/terms pair, shared by the in-memory trackers, the recovery sets and the persisted file paths so the format is defined once
  return `${serviceId}/${termsType}`;
}

export function generateFilePath(serviceId, termsType) {
  validatePathComponent(serviceId, 'serviceId');
  validatePathComponent(termsType, 'termsType');

  return `${termsKey(serviceId, termsType)}.json`; // Do not use `path.join` as Git requires forward slashes even on Windows
}

function validatePathComponent(value, name) { // Guards against path traversal when these components come from external sources (e.g. API parameters); shares the recorder's definition of a safe path segment
  if (typeof value !== 'string' || !isPlainPathSegment(value)) {
    throw new Error(`Invalid ${name}: must be a plain path segment (a non-empty string without separators, "." or ".." forms, or control characters), got ${JSON.stringify(value)}`);
  }
}

export function toPersistence(newResult, previousResult) {
  const eventType = determineEventType(previousResult, newResult);

  if (!eventType) {
    return null;
  }

  const messageParams = {
    serviceId: newResult.serviceId, // Commit subjects are keyed by the stable serviceId, aligned with snapshots/versions subjects and with the file paths, so a grep by id spans subjects and paths alike; the human-readable serviceName lives in the file content
    termsType: newResult.termsType,
  };

  if (eventType === EVENT_TYPES.TRACKING_FAILURE) {
    messageParams.failureType = deriveFailureType(newResult.event.reasons);
  }

  return {
    eventType, // Returned so callers (TrackingResultsRepository) can surface the detected event without re-running determineEventType
    message: formatMessage(eventType, messageParams),
    content: `${JSON.stringify(toJSON(newResult), null, 2)}\n`,
    filePath: generateFilePath(newResult.serviceId, newResult.termsType),
    date: newResult.event.date,
  };
}

export function toDomain({ serviceId, termsType, data }) {
  const result = new TermsResult({
    serviceId,
    termsType,
    status: data?.status,
    event: data?.event,
  });

  try {
    result.validate();
  } catch (error) {
    throw new Error(`Invalid TermsResult content for ${serviceId}/${termsType}: ${error.message}`);
  }

  return result;
}

export function deriveFailureType(reasons = []) {
  return FAILURE_TYPE_PRIORITY.find(type => reasons.some(reason => reason.startsWith(`[${type}]`))) || 'internal'; // Defaults to "internal" when no recognised prefix is found, which best reflects an unclassified engine-side problem
}

export function determineEventType(previousResult, newResult) {
  // Priority is deliberate and not commutative: when several substantive fields change in the same transition, the first matching branch wins and labels the commit.
  // Side-effect: a lower-priority change (e.g. declaration update) that coincides with a higher-priority change (e.g. transient error appearance) is still persisted in the file content but not attributed in the commit subject; if the higher-priority change later resolves with the declaration still updated, no further commit fires because the declaration is already in place. This is a documented audit-trail trade-off.

  if (!previousResult) {
    return EVENT_TYPES.FIRST_TRACKING;
  }

  if (previousResult.status !== newResult.status) {
    return newResult.status === STATUSES.failed
      ? EVENT_TYPES.TRACKING_FAILURE
      : EVENT_TYPES.TRACKING_RECOVERY;
  }

  // From here, status is the same on both sides.

  if (newResult.status === STATUSES.failed && !isDeepStrictEqual(previousResult.event.reasons, newResult.event.reasons)) { // Reasons are ordered: a different order is a different value
    return EVENT_TYPES.REASONS_CHANGED;
  }

  const previousTransient = previousResult.event.transientError;
  const newTransient = newResult.event.transientError;

  if (!previousTransient && newTransient) {
    return EVENT_TYPES.TRANSIENT_ERROR_DETECTED;
  }

  if (previousTransient && !newTransient) {
    return EVENT_TYPES.TRANSIENT_ERROR_RESOLVED;
  }

  if (previousTransient && newTransient && !isDeepStrictEqual(previousTransient.reasons, newTransient.reasons)) {
    return EVENT_TYPES.TRANSIENT_ERROR_DETECTED; // The latest transient error replaces the previous one; the file now reflects the new reasons
  }

  // From here, transient-error state is identical on both sides.

  if (sourceDocumentsDifferOnDeclaration(previousResult.event.sourceDocuments, newResult.event.sourceDocuments)) {
    return EVENT_TYPES.DECLARATION_UPDATED;
  }

  if (sourceDocumentsMimeTypeOnlyChanged(previousResult.event.sourceDocuments, newResult.event.sourceDocuments)) {
    return EVENT_TYPES.MIME_TYPE_UPDATED;
  }

  if (previousResult.event.serviceName !== newResult.event.serviceName) {
    return EVENT_TYPES.SERVICE_NAME_UPDATED;
  }

  return null;
}

export function formatMessage(eventType, { serviceId, termsType, failureType } = {}) {
  const suffix = `of ${serviceId} ${termsType}`;

  switch (eventType) {
  case EVENT_TYPES.FIRST_TRACKING:
    return `Record first tracking ${suffix}`;
  case EVENT_TYPES.TRACKING_FAILURE:
    return `Record tracking failure ${suffix} (${failureType})`;
  case EVENT_TYPES.TRACKING_RECOVERY:
    return `Record tracking recovery ${suffix}`;
  case EVENT_TYPES.REASONS_CHANGED:
    return `Update failure reasons ${suffix}`;
  case EVENT_TYPES.TRANSIENT_ERROR_DETECTED:
    return `Record transient error ${suffix}`;
  case EVENT_TYPES.TRANSIENT_ERROR_RESOLVED:
    return `Clear transient error ${suffix}`;
  case EVENT_TYPES.DECLARATION_UPDATED:
    return `Update tracking declaration ${suffix}`;
  case EVENT_TYPES.SERVICE_NAME_UPDATED:
    return `Update service name ${suffix}`;
  case EVENT_TYPES.MIME_TYPE_UPDATED:
    return `Update MIME type ${suffix}`;
  default:
    throw new Error(`Unknown tracking-result event type: "${eventType}"`);
  }
}

function toJSON(result) {
  const event = {
    date: result.event.date,
    serviceName: result.event.serviceName,
    sourceDocuments: result.event.sourceDocuments,
  };

  if (result.status === STATUSES.failed) {
    event.reasons = result.event.reasons;
  }

  if (result.event.transientError) {
    event.transientError = result.event.transientError;
  }

  return { status: result.status, event };
}

function declaredFieldsOf(sourceDocuments = []) {
  // Keeps only the fields that come from the declaration file (id, fetch, select, remove, filter, executeClientScripts). Drops mimeType (an observation from fetch, handled by its own MIME_TYPE_UPDATED event) and snapshotId (an observation from the snapshot record, which changes on every new snapshot but does not represent a tracking-results-level change).
  return sourceDocuments.map(({ mimeType, snapshotId, ...rest }) => rest); // eslint-disable-line no-unused-vars
}

function mimeTypesOf(sourceDocuments = []) {
  return sourceDocuments.map(doc => doc.mimeType ?? null);
}

function sourceDocumentsDifferOnDeclaration(previous, next) {
  return !isDeepStrictEqual(declaredFieldsOf(previous), declaredFieldsOf(next)); // sourceDocuments[i] is positional: reordering documents is a declaration change
}

function sourceDocumentsMimeTypeOnlyChanged(previous, next) {
  if (sourceDocumentsDifferOnDeclaration(previous, next)) {
    return false;
  }

  return !isDeepStrictEqual(mimeTypesOf(previous), mimeTypesOf(next));
}
