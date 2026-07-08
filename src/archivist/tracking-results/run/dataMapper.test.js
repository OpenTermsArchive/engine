import { expect } from 'chai';

import { FILE_NAME, formatMessage, toDomain, toPersistence } from './dataMapper.js';

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
    it('formats an in-progress run', () => {
      const run = new Run(VALID_PARAMS);

      expect(formatMessage(run)).to.equal('Start run ota-run-f47ac10b');
    });

    it('formats a completed run with counts read from run.tracked', () => {
      const run = new Run(VALID_PARAMS);

      run.markCompleted('2026-04-06T10:42:34Z');
      run.tracked = { ok: 1518, failed: 5 };

      expect(formatMessage(run)).to.equal('Complete run ota-run-f47ac10b (1518 ok, 5 failed)');
    });

    it('formats a crashed run', () => {
      const run = new Run(VALID_PARAMS);

      run.markCrashed('2026-04-06T10:42:34Z');

      expect(formatMessage(run)).to.equal('Finalize crashed run ota-run-f47ac10b');
    });

    it('throws for unknown status', () => {
      const run = new Run(VALID_PARAMS);

      run.lastRun.status = 'nonsense';

      expect(() => formatMessage(run)).to.throw(/Unknown run status/);
    });
  });

  describe('#toPersistence', () => {
    context('with an in-progress run', () => {
      let persistence;

      before(() => {
        persistence = toPersistence(new Run(VALID_PARAMS));
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

    context('with a completed run', () => {
      let persistence;

      before(() => {
        const run = new Run(VALID_PARAMS);

        run.markCompleted('2026-04-06T10:42:34Z');
        run.tracked = { ok: 1518, failed: 5 };
        persistence = toPersistence(run);
      });

      it('uses the Complete run subject with counts', () => {
        expect(persistence.message).to.equal('Complete run ota-run-f47ac10b (1518 ok, 5 failed)');
      });

      it('uses the end date once it is set', () => {
        expect(persistence.date).to.equal('2026-04-06T10:42:34Z');
      });
    });

    context('with a crashed run', () => {
      it('uses the Finalize crashed run subject', () => {
        const run = new Run(VALID_PARAMS);

        run.markCrashed('2026-04-06T10:42:34Z');
        expect(toPersistence(run).message).to.equal('Finalize crashed run ota-run-f47ac10b');
      });
    });
  });

  describe('#toDomain', () => {
    it('rebuilds a Run instance from persisted data', () => {
      const persistence = toPersistence(new Run(VALID_PARAMS));
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

      const persistence = toPersistence(original);
      const rebuilt = toDomain(JSON.parse(persistence.content));

      expect(rebuilt.lastRun.endDate).to.equal('2026-04-06T10:42:34Z');
      expect(rebuilt.lastRun.status).to.equal('completed');
      expect(rebuilt.tracked).to.deep.equal({ ok: 1518, failed: 5 });
      expect(rebuilt.coverage).to.deep.equal({ processed: 1523, skipped: [{ serviceId: 'X', termsType: 'Y', reason: 'declaration validation failed' }] });
      expect(rebuilt.transitions.newFailures).to.deep.equal([{ serviceId: 'A', termsType: 'B' }]);
      expect(rebuilt.transientErrors).to.equal(23);
      expect(toPersistence(rebuilt).content).to.equal(persistence.content);
    });

    context('when persisted data is invalid', () => {
      it('throws an error contextualised with the run domain', () => {
        const persistence = toPersistence(new Run(VALID_PARAMS));
        const data = JSON.parse(persistence.content);

        data.runId = 'bare-uuid-without-prefix';
        expect(() => toDomain(data)).to.throw(/Invalid run content/);
      });

      it('throws when a required nested field is missing', () => {
        const persistence = toPersistence(new Run(VALID_PARAMS));
        const data = JSON.parse(persistence.content);

        delete data.lastRun.startDate;
        expect(() => toDomain(data)).to.throw(/Invalid run content/);
      });
    });
  });
});
