import { expect } from 'chai';

import { EVENT_TYPES, FILE_NAME, formatMessage, toDomain, toPersistence } from './dataMapper.js';

import Run from './index.js';

const VALID_PARAMS = {
  runId: 'ota-run-f47ac10b-58cc-4372-a567-0e02b2c3d479',
  collectionId: 'france',
  schedule: '30 */12 * * *',
  startDate: '2026-04-06T10:30:00Z',
  engineVersion: '12.0.0',
  declarationsCommit: 'abc123def456',
  servicesCount: 1,
  termsCount: 1,
};

describe('run/dataMapper', () => {
  describe('FILE_NAME', () => {
    it('is run.json at the repository root', () => {
      expect(FILE_NAME).to.equal('run.json');
    });
  });

  describe('#formatMessage', () => {
    it('formats STARTED', () => {
      const run = new Run(VALID_PARAMS);

      expect(formatMessage(EVENT_TYPES.STARTED, run)).to.equal('Start run ota-run-f47ac10b');
    });

    it('formats COMPLETED with counts read from run.tracked', () => {
      const run = new Run(VALID_PARAMS);

      run.markCompleted('2026-04-06T10:42:34Z');
      run.tracked = { ok: 1518, failed: 5 };

      expect(formatMessage(EVENT_TYPES.COMPLETED, run)).to.equal('Complete run ota-run-f47ac10b (1518 ok, 5 failed)');
    });

    it('formats FINALIZED_CRASHED', () => {
      const run = new Run(VALID_PARAMS);

      run.markCrashed('2026-04-06T10:42:34Z');

      expect(formatMessage(EVENT_TYPES.FINALIZED_CRASHED, run)).to.equal('Finalize crashed run ota-run-f47ac10b');
    });

    it('throws for unknown event type', () => {
      expect(() => formatMessage('nonsense', new Run(VALID_PARAMS))).to.throw(/Unknown run event type/);
    });
  });

  describe('#toPersistence', () => {
    context('with STARTED', () => {
      let persistence;

      before(() => {
        persistence = toPersistence(new Run(VALID_PARAMS), EVENT_TYPES.STARTED);
      });

      it('uses the Start run subject', () => {
        expect(persistence.message).to.equal('Start run ota-run-f47ac10b');
      });

      it('writes to run.json at the repository root', () => {
        expect(persistence.filePath).to.equal('run.json');
      });

      it('serialises the run payload structure as pretty JSON terminated by a newline', () => {
        const parsed = JSON.parse(persistence.content);

        expect(parsed).to.have.all.keys([ 'runId', 'collectionId', 'schedule', 'lastRun', 'declarations', 'tracked', 'coverage', 'transitions', 'transientErrors' ]);
        expect(parsed.runId).to.equal('ota-run-f47ac10b-58cc-4372-a567-0e02b2c3d479');
        expect(persistence.content.endsWith('\n')).to.be.true;
      });

      it('uses the start date when no end date is set', () => {
        expect(persistence.date).to.equal('2026-04-06T10:30:00Z');
      });
    });

    context('with COMPLETED', () => {
      let persistence;

      before(() => {
        const run = new Run(VALID_PARAMS);

        run.markCompleted('2026-04-06T10:42:34Z');
        run.tracked = { ok: 1518, failed: 5 };
        persistence = toPersistence(run, EVENT_TYPES.COMPLETED);
      });

      it('uses the Complete run subject with counts', () => {
        expect(persistence.message).to.equal('Complete run ota-run-f47ac10b (1518 ok, 5 failed)');
      });

      it('uses the end date once it is set', () => {
        expect(persistence.date).to.equal('2026-04-06T10:42:34Z');
      });
    });

    context('with FINALIZED_CRASHED', () => {
      it('uses the Finalize crashed run subject', () => {
        const run = new Run(VALID_PARAMS);

        run.markCrashed('2026-04-06T10:42:34Z');
        expect(toPersistence(run, EVENT_TYPES.FINALIZED_CRASHED).message).to.equal('Finalize crashed run ota-run-f47ac10b');
      });
    });
  });

  describe('#toDomain', () => {
    it('rebuilds a Run instance from persisted data', () => {
      const persistence = toPersistence(new Run(VALID_PARAMS), EVENT_TYPES.STARTED);
      const data = JSON.parse(persistence.content);
      const run = toDomain(data);

      expect(run).to.be.instanceOf(Run);
      expect(run.runId).to.equal(VALID_PARAMS.runId);
      expect(run.lastRun.status).to.equal('in_progress');
      expect(run.shortRunId).to.equal('ota-run-f47ac10b');
    });

    it('restores lifecycle state (status, endDate, tracked, coverage, transitions, transientErrors)', () => {
      const original = new Run(VALID_PARAMS);

      original.markCompleted('2026-04-06T10:42:34Z');
      original.tracked = { ok: 1518, failed: 5 };
      original.coverage = { processed: 1523, skipped: [{ serviceId: 'X', termsType: 'Y', reason: 'declaration validation failed' }] };
      original.recordTransition('newFailures', { serviceId: 'A', termsType: 'B' });
      original.transientErrors = 23;

      const persistence = toPersistence(original, EVENT_TYPES.COMPLETED);
      const rebuilt = toDomain(JSON.parse(persistence.content));

      expect(rebuilt.lastRun.endDate).to.equal('2026-04-06T10:42:34Z');
      expect(rebuilt.lastRun.status).to.equal('completed');
      expect(rebuilt.tracked).to.deep.equal({ ok: 1518, failed: 5 });
      expect(rebuilt.coverage).to.deep.equal({ processed: 1523, skipped: [{ serviceId: 'X', termsType: 'Y', reason: 'declaration validation failed' }] });
      expect(rebuilt.transitions.newFailures).to.deep.equal([{ serviceId: 'A', termsType: 'B' }]);
      expect(rebuilt.transientErrors).to.equal(23);
    });

    context('when persisted data is invalid', () => {
      it('throws an error contextualised with the run domain', () => {
        const persistence = toPersistence(new Run(VALID_PARAMS), EVENT_TYPES.STARTED);
        const data = JSON.parse(persistence.content);

        data.runId = 'bare-uuid-without-prefix';
        expect(() => toDomain(data)).to.throw(/Invalid run content/);
      });

      it('throws when a required nested field is missing', () => {
        const persistence = toPersistence(new Run(VALID_PARAMS), EVENT_TYPES.STARTED);
        const data = JSON.parse(persistence.content);

        delete data.lastRun.startDate;
        expect(() => toDomain(data)).to.throw(/Invalid run content/);
      });
    });
  });
});
