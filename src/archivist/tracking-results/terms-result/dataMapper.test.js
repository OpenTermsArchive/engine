import { expect } from 'chai';

import {
  EVENT_TYPES,
  TRANSITIONS_BY_EVENT_TYPE,
  deriveFailureType,
  determineEventType,
  formatMessage,
  generateFilePath,
  toDomain,
  toPersistence,
} from './dataMapper.js';

import TermsResult, { STATUSES } from './index.js';

const SERVICE_ID = 'Facebook';
const SERVICE_NAME = 'Facebook';
const TERMS_TYPE = 'Terms of Service';

const SOURCE_DOCUMENTS = [{
  id: 'main',
  fetch: 'https://example.com',
  select: '.content',
  remove: '',
  filter: [],
  executeClientScripts: false,
  mimeType: 'text/html',
  snapshotId: 'def456',
}];

function makeResult({
  status = STATUSES.ok,
  serviceName = SERVICE_NAME,
  sourceDocuments = SOURCE_DOCUMENTS,
  reasons,
  transientError,
  date = '2026-01-10T10:30:00Z',
} = {}) {
  const event = { date, serviceName, sourceDocuments };

  if (reasons) {
    event.reasons = reasons;
  }

  if (transientError) {
    event.transientError = transientError;
  }

  return new TermsResult({ serviceId: SERVICE_ID, termsType: TERMS_TYPE, status, event });
}

describe('tracking-result/dataMapper', () => {
  describe('#generateFilePath', () => {
    it('joins serviceId and termsType with a forward slash and a .json extension', () => {
      expect(generateFilePath('Facebook', 'Terms of Service')).to.equal('Facebook/Terms of Service.json');
    });

    it('accepts dots in the middle of components', () => {
      expect(generateFilePath('Facebook v2.0', 'Terms of Service')).to.equal('Facebook v2.0/Terms of Service.json');
    });

    [ '../etc', 'a/b', 'a\\b', 'with\0null', 'line\nbreak', '.', '..', '', null, undefined, 123 ].forEach(bad => {
      it(`rejects serviceId ${JSON.stringify(bad)}`, () => {
        expect(() => generateFilePath(bad, 'Terms of Service')).to.throw(/Invalid serviceId/);
      });

      it(`rejects termsType ${JSON.stringify(bad)}`, () => {
        expect(() => generateFilePath('Facebook', bad)).to.throw(/Invalid termsType/);
      });
    });
  });

  describe('#deriveFailureType', () => {
    it('returns "fetch" when any reason is prefixed with [fetch]', () => {
      expect(deriveFailureType([ '[extraction] selector miss', '[fetch] HTTP 500' ])).to.equal('fetch');
    });

    it('returns "extraction" when reasons mix [extraction] and [internal] without [fetch]', () => {
      expect(deriveFailureType([ '[internal] boom', '[extraction] selector miss' ])).to.equal('extraction');
    });

    it('returns "internal" when only [internal] reasons are present', () => {
      expect(deriveFailureType(['[internal] boom'])).to.equal('internal');
    });

    it('returns "internal" when no recognised prefix is found', () => {
      expect(deriveFailureType(['something weird'])).to.equal('internal');
    });

    it('returns "internal" when reasons are empty', () => {
      expect(deriveFailureType([])).to.equal('internal');
    });
  });

  describe('#determineEventType', () => {
    context('with no previous result', () => {
      it('returns FIRST_TRACKING', () => {
        expect(determineEventType(null, makeResult())).to.equal(EVENT_TYPES.FIRST_TRACKING);
      });
    });

    context('when status transitions from ok to failed', () => {
      it('returns TRACKING_FAILURE', () => {
        const prev = makeResult();
        const next = makeResult({ status: STATUSES.failed, reasons: ['[fetch] HTTP 500'] });

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.TRACKING_FAILURE);
      });
    });

    context('when status transitions from failed to ok', () => {
      it('returns TRACKING_RECOVERY', () => {
        const prev = makeResult({ status: STATUSES.failed, reasons: ['[fetch] HTTP 500'] });
        const next = makeResult();

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.TRACKING_RECOVERY);
      });
    });

    context('when same failed status with different reasons', () => {
      it('returns REASONS_CHANGED', () => {
        const prev = makeResult({ status: STATUSES.failed, reasons: ['[fetch] HTTP 500'] });
        const next = makeResult({ status: STATUSES.failed, reasons: ['[fetch] HTTP 404'] });

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.REASONS_CHANGED);
      });
    });

    context('when transient error appears', () => {
      it('returns TRANSIENT_ERROR_DETECTED', () => {
        expect(determineEventType(makeResult(), makeResult({ transientError: { reasons: ['[fetch] HTTP 503'] } }))).to.equal(EVENT_TYPES.TRANSIENT_ERROR_DETECTED);
      });
    });

    context('when transient error disappears', () => {
      it('returns TRANSIENT_ERROR_RESOLVED', () => {
        expect(determineEventType(makeResult({ transientError: { reasons: ['[fetch] HTTP 503'] } }), makeResult())).to.equal(EVENT_TYPES.TRANSIENT_ERROR_RESOLVED);
      });
    });

    context('when transient error reasons change while both runs have one', () => {
      it('returns TRANSIENT_ERROR_DETECTED', () => {
        const prev = makeResult({ transientError: { reasons: ['[fetch] HTTP 503'] } });
        const next = makeResult({ transientError: { reasons: ['[fetch] HTTP 504'] } });

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.TRANSIENT_ERROR_DETECTED);
      });
    });

    context('when source documents differ on a non-mimeType field', () => {
      it('returns DECLARATION_UPDATED', () => {
        const prev = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', select: '.x', mimeType: 'text/html', snapshotId: 'abc' }] });
        const next = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://b.example', select: '.x', mimeType: 'text/html', snapshotId: 'abc' }] });

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.DECLARATION_UPDATED);
      });

      it('is insensitive to source-document key ordering', () => {
        const prev = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', select: '.x', mimeType: 'text/html', snapshotId: 'abc' }] });
        const next = makeResult({ sourceDocuments: [{ snapshotId: 'abc', mimeType: 'text/html', select: '.x', fetch: 'https://a.example', id: 'main' }] }); // Same keys, different order

        expect(determineEventType(prev, next)).to.equal(null);
      });
    });

    context('when only mimeType differs in source documents', () => {
      it('returns MIME_TYPE_UPDATED', () => {
        const prev = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', select: '.x', mimeType: 'text/html', snapshotId: 'abc' }] });
        const next = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', select: '.x', mimeType: 'application/pdf', snapshotId: 'abc' }] });

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.MIME_TYPE_UPDATED);
      });
    });

    context('when only snapshotId differs in source documents', () => {
      it('returns null (snapshotId is an observation, not a declared field, and has no dedicated event)', () => {
        const prev = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', select: '.x', mimeType: 'text/html', snapshotId: 'old-sha' }] });
        const next = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', select: '.x', mimeType: 'text/html', snapshotId: 'new-sha' }] });

        expect(determineEventType(prev, next)).to.equal(null);
      });
    });

    context('when both snapshotId and a declared field differ', () => {
      it('returns DECLARATION_UPDATED (the declared field change takes precedence)', () => {
        const prev = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', select: '.x', mimeType: 'text/html', snapshotId: 'old-sha' }] });
        const next = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://b.example', select: '.x', mimeType: 'text/html', snapshotId: 'new-sha' }] });

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.DECLARATION_UPDATED);
      });
    });

    context('when snapshotId differs and mimeType also differs', () => {
      it('returns MIME_TYPE_UPDATED (snapshotId change alone is ignored)', () => {
        const prev = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', select: '.x', mimeType: 'text/html', snapshotId: 'old-sha' }] });
        const next = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', select: '.x', mimeType: 'application/pdf', snapshotId: 'new-sha' }] });

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.MIME_TYPE_UPDATED);
      });
    });

    context('when only serviceName differs', () => {
      it('returns SERVICE_NAME_UPDATED', () => {
        expect(determineEventType(makeResult({ serviceName: 'Facebook' }), makeResult({ serviceName: 'Facebook Inc.' }))).to.equal(EVENT_TYPES.SERVICE_NAME_UPDATED);
      });
    });

    context('when no substantive change', () => {
      it('returns null', () => {
        expect(determineEventType(makeResult(), makeResult())).to.equal(null);
      });

      context('when the same transient error reasons are present on both sides', () => {
        it('returns null', () => {
          const prev = makeResult({ transientError: { reasons: ['[fetch] HTTP 503'] } });
          const next = makeResult({ transientError: { reasons: ['[fetch] HTTP 503'] } });

          expect(determineEventType(prev, next)).to.equal(null);
        });
      });

      context('when reasons order is the same on both sides', () => {
        it('returns null (reasons are order-sensitive)', () => {
          const prev = makeResult({ status: STATUSES.failed, reasons: [ '[fetch] HTTP 500', '[extraction] selector miss' ] });
          const next = makeResult({ status: STATUSES.failed, reasons: [ '[fetch] HTTP 500', '[extraction] selector miss' ] });

          expect(determineEventType(prev, next)).to.equal(null);
        });
      });
    });

    context('when source document count changes', () => {
      it('returns DECLARATION_UPDATED when a document is added', () => {
        const prev = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', mimeType: 'text/html' }] });
        const next = makeResult({
          sourceDocuments: [
            { id: 'main', fetch: 'https://a.example', mimeType: 'text/html' },
            { id: 'extra', fetch: 'https://b.example', mimeType: 'text/html' },
          ],
        });

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.DECLARATION_UPDATED);
      });

      it('returns DECLARATION_UPDATED when a document is removed', () => {
        const prev = makeResult({
          sourceDocuments: [
            { id: 'main', fetch: 'https://a.example', mimeType: 'text/html' },
            { id: 'extra', fetch: 'https://b.example', mimeType: 'text/html' },
          ],
        });
        const next = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', mimeType: 'text/html' }] });

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.DECLARATION_UPDATED);
      });

      it('returns DECLARATION_UPDATED when previous had no documents and new has one', () => {
        const prev = makeResult({ sourceDocuments: [] });
        const next = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', mimeType: 'text/html' }] });

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.DECLARATION_UPDATED);
      });
    });

    context('when reasons order changes (same elements, different order)', () => {
      it('returns REASONS_CHANGED because reasons are order-sensitive', () => {
        const prev = makeResult({ status: STATUSES.failed, reasons: [ '[fetch] HTTP 500', '[extraction] selector miss' ] });
        const next = makeResult({ status: STATUSES.failed, reasons: [ '[extraction] selector miss', '[fetch] HTTP 500' ] });

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.REASONS_CHANGED);
      });
    });

    context('when a deeply nested source document field changes', () => {
      it('returns DECLARATION_UPDATED', () => {
        const prev = makeResult({ sourceDocuments: [{ id: 'main', options: { timeout: 5000 }, mimeType: 'text/html' }] });
        const next = makeResult({ sourceDocuments: [{ id: 'main', options: { timeout: 9000 }, mimeType: 'text/html' }] });

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.DECLARATION_UPDATED);
      });
    });

    context('priority', () => {
      it('prioritises status transition over reasons change', () => {
        const prev = makeResult({ status: STATUSES.failed, reasons: ['[fetch] HTTP 500'] });
        const next = makeResult();

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.TRACKING_RECOVERY);
      });

      it('prioritises status transition over transient error appearance', () => {
        const prev = makeResult();
        const next = makeResult({ status: STATUSES.failed, reasons: ['[fetch] HTTP 500'], transientError: { reasons: ['[fetch] HTTP 503'] } });

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.TRACKING_FAILURE);
      });

      it('prioritises reasons change over declaration update for same failed status', () => {
        const prev = makeResult({ status: STATUSES.failed, reasons: ['[fetch] HTTP 500'], sourceDocuments: [{ id: 'main', fetch: 'https://a.example', select: '.x', mimeType: 'text/html', snapshotId: 'abc' }] });
        const next = makeResult({ status: STATUSES.failed, reasons: ['[fetch] HTTP 404'], sourceDocuments: [{ id: 'main', fetch: 'https://b.example', select: '.x', mimeType: 'text/html', snapshotId: 'abc' }] });

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.REASONS_CHANGED);
      });

      it('prioritises transient error appearance over declaration update', () => {
        const prev = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', select: '.x', mimeType: 'text/html', snapshotId: 'abc' }] });
        const next = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://b.example', select: '.x', mimeType: 'text/html', snapshotId: 'abc' }], transientError: { reasons: ['[fetch] HTTP 503'] } });

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.TRANSIENT_ERROR_DETECTED);
      });

      it('prioritises declaration update over MIME type when both differ', () => {
        const prev = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', select: '.x', mimeType: 'text/html', snapshotId: 'abc' }] });
        const next = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', select: '.y', mimeType: 'application/pdf', snapshotId: 'abc' }] });

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.DECLARATION_UPDATED);
      });

      it('prioritises declaration update over service name when both differ', () => {
        const prev = makeResult({ serviceName: 'Facebook', sourceDocuments: [{ id: 'main', fetch: 'https://a.example', select: '.x', mimeType: 'text/html', snapshotId: 'abc' }] });
        const next = makeResult({ serviceName: 'Facebook Inc.', sourceDocuments: [{ id: 'main', fetch: 'https://b.example', select: '.x', mimeType: 'text/html', snapshotId: 'abc' }] });

        expect(determineEventType(prev, next)).to.equal(EVENT_TYPES.DECLARATION_UPDATED);
      });
    });
  });

  describe('TRANSITIONS_BY_EVENT_TYPE', () => {
    it('maps only the true transition event types', () => {
      expect(TRANSITIONS_BY_EVENT_TYPE).to.deep.equal({
        [EVENT_TYPES.TRACKING_FAILURE]: 'newFailures',
        [EVENT_TYPES.TRACKING_RECOVERY]: 'recoveries',
        [EVENT_TYPES.REASONS_CHANGED]: 'reasonChanges',
      });
    });
  });

  describe('#formatMessage', () => {
    const params = { serviceId: SERVICE_ID, termsType: TERMS_TYPE };

    it('formats FIRST_TRACKING', () => {
      expect(formatMessage(EVENT_TYPES.FIRST_TRACKING, params)).to.equal('Record first tracking of Facebook Terms of Service');
    });

    it('formats TRACKING_FAILURE with fetch type', () => {
      expect(formatMessage(EVENT_TYPES.TRACKING_FAILURE, { ...params, failureType: 'fetch' })).to.equal('Record tracking failure of Facebook Terms of Service (fetch)');
    });

    it('formats TRACKING_FAILURE with extraction type', () => {
      expect(formatMessage(EVENT_TYPES.TRACKING_FAILURE, { ...params, failureType: 'extraction' })).to.equal('Record tracking failure of Facebook Terms of Service (extraction)');
    });

    it('formats TRACKING_FAILURE with internal type', () => {
      expect(formatMessage(EVENT_TYPES.TRACKING_FAILURE, { ...params, failureType: 'internal' })).to.equal('Record tracking failure of Facebook Terms of Service (internal)');
    });

    it('formats TRACKING_RECOVERY', () => {
      expect(formatMessage(EVENT_TYPES.TRACKING_RECOVERY, params)).to.equal('Record tracking recovery of Facebook Terms of Service');
    });

    it('formats REASONS_CHANGED', () => {
      expect(formatMessage(EVENT_TYPES.REASONS_CHANGED, params)).to.equal('Update failure reasons of Facebook Terms of Service');
    });

    it('formats TRANSIENT_ERROR_DETECTED', () => {
      expect(formatMessage(EVENT_TYPES.TRANSIENT_ERROR_DETECTED, params)).to.equal('Record transient error of Facebook Terms of Service');
    });

    it('formats TRANSIENT_ERROR_RESOLVED', () => {
      expect(formatMessage(EVENT_TYPES.TRANSIENT_ERROR_RESOLVED, params)).to.equal('Clear transient error of Facebook Terms of Service');
    });

    it('formats DECLARATION_UPDATED', () => {
      expect(formatMessage(EVENT_TYPES.DECLARATION_UPDATED, params)).to.equal('Update tracking declaration of Facebook Terms of Service');
    });

    it('formats SERVICE_NAME_UPDATED', () => {
      expect(formatMessage(EVENT_TYPES.SERVICE_NAME_UPDATED, params)).to.equal('Update service name of Facebook Terms of Service');
    });

    it('formats MIME_TYPE_UPDATED', () => {
      expect(formatMessage(EVENT_TYPES.MIME_TYPE_UPDATED, params)).to.equal('Update MIME type of Facebook Terms of Service');
    });

    it('throws for unknown event type', () => {
      expect(() => formatMessage('nonsense', params)).to.throw(/Unknown tracking-result event type/);
    });
  });

  describe('#toPersistence', () => {
    context('when there is no substantive change', () => {
      it('returns null', () => {
        expect(toPersistence(makeResult(), makeResult())).to.be.null;
      });
    });

    context('on first record', () => {
      let persistence;

      before(() => {
        persistence = toPersistence(makeResult(), null);
      });

      it('uses the first-tracking commit subject', () => {
        expect(persistence.message).to.equal('Record first tracking of Facebook Terms of Service');
      });

      it('serialises status and event as pretty JSON terminated by a newline', () => {
        expect(persistence.content).to.equal(`${JSON.stringify({
          status: 'ok',
          event: {
            date: '2026-01-10T10:30:00Z',
            serviceName: 'Facebook',
            sourceDocuments: SOURCE_DOCUMENTS,
          },
        }, null, 2)}\n`);
      });

      it('uses the per-terms file path', () => {
        expect(persistence.filePath).to.equal('Facebook/Terms of Service.json');
      });

      it('uses the event date', () => {
        expect(persistence.date).to.equal('2026-01-10T10:30:00Z');
      });
    });

    context('on tracking failure', () => {
      let persistence;

      before(() => {
        persistence = toPersistence(makeResult({ status: STATUSES.failed, reasons: [ '[extraction] selector miss', '[fetch] HTTP 500' ] }), makeResult());
      });

      it('appends the failure type derived from reasons to the subject', () => {
        expect(persistence.message).to.equal('Record tracking failure of Facebook Terms of Service (fetch)');
      });

      it('includes the reasons in the persisted content', () => {
        const parsed = JSON.parse(persistence.content);

        expect(parsed.status).to.equal('failed');
        expect(parsed.event.reasons).to.deep.equal([ '[extraction] selector miss', '[fetch] HTTP 500' ]);
      });
    });

    context('when a transient error is present on an ok status', () => {
      it('includes the transientError in the persisted content', () => {
        const persistence = toPersistence(makeResult({ transientError: { reasons: ['[fetch] HTTP 503'] } }), null);
        const parsed = JSON.parse(persistence.content);

        expect(parsed.event.transientError).to.deep.equal({ reasons: ['[fetch] HTTP 503'] });
      });
    });

    context('on tracking recovery', () => {
      it('uses the recovery commit subject', () => {
        const prev = makeResult({ status: STATUSES.failed, reasons: ['[fetch] HTTP 500'] });
        const persistence = toPersistence(makeResult(), prev);

        expect(persistence.message).to.equal('Record tracking recovery of Facebook Terms of Service');
      });

      it('does not include reasons in the persisted content', () => {
        const prev = makeResult({ status: STATUSES.failed, reasons: ['[fetch] HTTP 500'] });
        const persistence = toPersistence(makeResult(), prev);
        const parsed = JSON.parse(persistence.content);

        expect(parsed.event.reasons).to.be.undefined;
        expect(parsed.status).to.equal('ok');
      });
    });

    context('on reasons change', () => {
      it('uses the reasons-changed commit subject and reflects the new reasons', () => {
        const prev = makeResult({ status: STATUSES.failed, reasons: ['[fetch] HTTP 500'] });
        const next = makeResult({ status: STATUSES.failed, reasons: ['[fetch] HTTP 404'] });
        const persistence = toPersistence(next, prev);

        expect(persistence.message).to.equal('Update failure reasons of Facebook Terms of Service');
        expect(JSON.parse(persistence.content).event.reasons).to.deep.equal(['[fetch] HTTP 404']);
      });
    });

    context('on transient error resolved', () => {
      it('uses the clear-transient-error commit subject and omits transientError from content', () => {
        const prev = makeResult({ transientError: { reasons: ['[fetch] HTTP 503'] } });
        const persistence = toPersistence(makeResult(), prev);

        expect(persistence.message).to.equal('Clear transient error of Facebook Terms of Service');
        expect(JSON.parse(persistence.content).event.transientError).to.be.undefined;
      });
    });

    context('on declaration updated', () => {
      it('uses the declaration-update commit subject', () => {
        const prev = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', mimeType: 'text/html', snapshotId: 'abc' }] });
        const next = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://b.example', mimeType: 'text/html', snapshotId: 'abc' }] });
        const persistence = toPersistence(next, prev);

        expect(persistence.message).to.equal('Update tracking declaration of Facebook Terms of Service');
      });
    });

    context('on MIME type updated', () => {
      it('uses the mime-type-update commit subject and reflects the new mimeType', () => {
        const prev = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', mimeType: 'text/html', snapshotId: 'abc' }] });
        const next = makeResult({ sourceDocuments: [{ id: 'main', fetch: 'https://a.example', mimeType: 'application/pdf', snapshotId: 'abc' }] });
        const persistence = toPersistence(next, prev);

        expect(persistence.message).to.equal('Update MIME type of Facebook Terms of Service');
        expect(JSON.parse(persistence.content).event.sourceDocuments[0].mimeType).to.equal('application/pdf');
      });
    });

    context('on service name updated', () => {
      it('uses the service-name-update commit subject, keyed by the stable serviceId', () => {
        const prev = makeResult({ serviceName: 'Facebook' });
        const next = makeResult({ serviceName: 'Facebook Inc.' });
        const persistence = toPersistence(next, prev);

        expect(persistence.message).to.equal('Update service name of Facebook Terms of Service'); // The subject carries the serviceId, not the (new) serviceName, so grepping the history by id spans the rename
      });
    });
  });

  describe('#toDomain', () => {
    it('rebuilds a TermsResult from persisted data', () => {
      const data = {
        status: 'ok',
        event: { date: '2026-01-10T10:30:00Z', serviceName: 'Google', sourceDocuments: SOURCE_DOCUMENTS },
      };

      const result = toDomain({ serviceId: 'Google', termsType: 'Privacy Policy', data });

      expect(result).to.be.instanceOf(TermsResult);
      expect(result.serviceId).to.equal('Google');
      expect(result.termsType).to.equal('Privacy Policy');
      expect(result.status).to.equal('ok');
      expect(result.event.date).to.equal('2026-01-10T10:30:00Z');
    });

    context('when persisted data is invalid', () => {
      it('throws an error contextualised with the service and terms type', () => {
        const data = { status: 'unknown', event: { date: '2026-01-10T10:30:00Z', serviceName: 'Google', sourceDocuments: SOURCE_DOCUMENTS } };

        expect(() => toDomain({ serviceId: 'Google', termsType: 'Privacy Policy', data })).to.throw(/Invalid TermsResult content for Google\/Privacy Policy/);
      });

      it('throws when a required event field is missing', () => {
        const data = { status: 'ok', event: { date: '2026-01-10T10:30:00Z', sourceDocuments: SOURCE_DOCUMENTS } };

        expect(() => toDomain({ serviceId: 'Google', termsType: 'Privacy Policy', data })).to.throw(/Invalid TermsResult content for Google\/Privacy Policy/);
      });
    });
  });
});
