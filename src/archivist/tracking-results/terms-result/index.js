/**
 * Tracking result for a single terms (service × termsType) on a given run
 * Persisted as `{serviceId}/{termsType}.json` in the tracking-results repository
 */

export const STATUSES = Object.freeze({ ok: 'ok', failed: 'failed' });

const VALID_STATUSES = Object.freeze(Object.values(STATUSES));

export default class TermsResult {
  static REQUIRED_PARAMS = Object.freeze([ 'serviceId', 'termsType', 'status', 'event' ]);
  static REQUIRED_EVENT_FIELDS = Object.freeze([ 'date', 'serviceName' ]);

  constructor(params) {
    Object.assign(this, params && JSON.parse(JSON.stringify(params))); // Normalise to the JSON round-trip so the in-memory instance always matches its persisted-then-re-read form (undefined-valued keys are dropped, as JSON.stringify would drop them at write time); change detection compares both sides with a key-sensitive deep equality
  }

  validate() {
    for (const requiredParam of this.constructor.REQUIRED_PARAMS) {
      if (!Object.prototype.hasOwnProperty.call(this, requiredParam) || this[requiredParam] == null) {
        throw new Error(`${this.constructor.name} is not valid; "${requiredParam}" is missing`);
      }
    }

    if (!VALID_STATUSES.includes(this.status)) {
      throw new Error(`${this.constructor.name} is not valid; "status" must be one of "${VALID_STATUSES.join('", "')}", got "${this.status}"`);
    }

    for (const eventField of this.constructor.REQUIRED_EVENT_FIELDS) {
      if (this.event[eventField] == null) {
        throw new Error(`${this.constructor.name} is not valid; "event.${eventField}" is missing`);
      }
    }

    if (!Array.isArray(this.event.sourceDocuments)) {
      throw new Error(`${this.constructor.name} is not valid; "event.sourceDocuments" must be an array`);
    }

    if (this.status === STATUSES.failed && (!Array.isArray(this.event.reasons) || this.event.reasons.length === 0)) {
      throw new Error(`${this.constructor.name} is not valid; "event.reasons" must be a non-empty array when status is "failed"`);
    }

    if (this.event.transientError && (!Array.isArray(this.event.transientError.reasons) || this.event.transientError.reasons.length === 0)) {
      throw new Error(`${this.constructor.name} is not valid; "event.transientError.reasons" must be a non-empty array`);
    }
  }
}
