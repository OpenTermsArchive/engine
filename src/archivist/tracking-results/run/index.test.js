import { expect } from 'chai';

import Run from './index.js';

const VALID_PARAMS = {
  runId: 'ota-run-f47ac10b-58cc-4372-a567-0e02b2c3d479',
  collectionId: 'france',
  schedule: '30 */12 * * *',
  startDate: '2026-04-06T10:30:00Z',
  engineVersion: '12.0.0',
  declarationsCommit: 'abc123def456',
  servicesCount: 523,
  termsCount: 1523,
};

describe('Run', () => {
  let subject;

  describe('.generateId', () => {
    it('returns an id with the "ota-run-" prefix and a UUID payload', () => {
      const id = Run.generateId();

      expect(id).to.match(/^ota-run-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('produces distinct ids on successive calls', () => {
      expect(Run.generateId()).to.not.equal(Run.generateId());
    });

    it('produces ids accepted by Run.validate', () => {
      const run = new Run({ ...VALID_PARAMS, runId: Run.generateId() });

      expect(() => run.validate()).to.not.throw();
    });
  });

  describe('constructor', () => {
    context('with flat params (initial construction)', () => {
      before(() => {
        subject = new Run(VALID_PARAMS);
      });

      it('exposes runId, collectionId and schedule at the root', () => {
        expect(subject.runId).to.equal('ota-run-f47ac10b-58cc-4372-a567-0e02b2c3d479');
        expect(subject.collectionId).to.equal('france');
        expect(subject.schedule).to.equal('30 */12 * * *');
      });

      it('initializes lastRun with status "in_progress" and no endDate', () => {
        expect(subject.lastRun).to.deep.equal({
          startDate: '2026-04-06T10:30:00Z',
          endDate: null,
          engineVersion: '12.0.0',
          status: 'in_progress',
        });
      });

      it('initializes declarations with the commit and counts', () => {
        expect(subject.declarations).to.deep.equal({
          commit: 'abc123def456',
          services: 523,
          terms: 1523,
        });
      });

      it('initializes tracked counters to zero', () => {
        expect(subject.tracked).to.deep.equal({ ok: 0, failed: 0 });
      });

      it('initializes coverage with empty skipped array', () => {
        expect(subject.coverage).to.deep.equal({ processed: 0, skipped: [] });
      });

      it('initializes transitions with empty arrays', () => {
        expect(subject.transitions).to.deep.equal({ newFailures: [], recoveries: [], reasonChanges: [] });
      });

      it('initializes transientErrors to zero', () => {
        expect(subject.transientErrors).to.equal(0);
      });

      context('when no schedule is provided', () => {
        it('defaults schedule to null', () => {
          const run = new Run({ ...VALID_PARAMS, schedule: undefined });

          expect(run.schedule).to.be.null;
        });
      });
    });
  });

  describe('#shortRunId', () => {
    it('returns the prefixed first segment of the UUID', () => {
      subject = new Run(VALID_PARAMS);
      expect(subject.shortRunId).to.equal('ota-run-f47ac10b');
    });

    it('throws when the runId does not match the expected format', () => {
      subject = new Run({ ...VALID_PARAMS, runId: 'not-a-valid-id' });
      expect(() => subject.shortRunId).to.throw(/Invalid runId/);
    });
  });

  describe('#markCompleted', () => {
    it('sets status to "completed" and records the endDate', () => {
      subject = new Run(VALID_PARAMS);
      subject.markCompleted('2026-04-06T10:42:34Z');
      expect(subject.lastRun.status).to.equal('completed');
      expect(subject.lastRun.endDate).to.equal('2026-04-06T10:42:34Z');
    });
  });

  describe('#markCrashed', () => {
    it('sets status to "crashed" and records the endDate', () => {
      subject = new Run(VALID_PARAMS);
      subject.markCrashed('2026-04-06T10:42:34Z');
      expect(subject.lastRun.status).to.equal('crashed');
      expect(subject.lastRun.endDate).to.equal('2026-04-06T10:42:34Z');
    });
  });

  describe('#addSkipped', () => {
    it('appends an entry to coverage.skipped', () => {
      subject = new Run(VALID_PARAMS);
      subject.addSkipped({ serviceId: 'Facebook', termsType: 'Terms of Service', reason: 'declaration validation failed' });
      expect(subject.coverage.skipped).to.deep.equal([
        { serviceId: 'Facebook', termsType: 'Terms of Service', reason: 'declaration validation failed' },
      ]);
    });

    it('accumulates multiple entries in order', () => {
      subject = new Run(VALID_PARAMS);
      subject.addSkipped({ serviceId: 'A', termsType: 'ToS', reason: 'bad A' });
      subject.addSkipped({ serviceId: 'B', termsType: 'PP', reason: 'bad B' });
      expect(subject.coverage.skipped).to.deep.equal([
        { serviceId: 'A', termsType: 'ToS', reason: 'bad A' },
        { serviceId: 'B', termsType: 'PP', reason: 'bad B' },
      ]);
    });
  });

  describe('#recordTransition', () => {
    [ 'newFailures', 'recoveries', 'reasonChanges' ].forEach(type => {
      context(`with type "${type}"`, () => {
        it('appends to the matching transitions list', () => {
          subject = new Run(VALID_PARAMS);
          subject.recordTransition(type, { serviceId: 'Facebook', termsType: 'Terms of Service' });
          expect(subject.transitions[type]).to.deep.equal([
            { serviceId: 'Facebook', termsType: 'Terms of Service' },
          ]);
        });
      });
    });

    context('with an unknown type', () => {
      it('throws an error', () => {
        subject = new Run(VALID_PARAMS);
        expect(() => subject.recordTransition('unknown', { serviceId: 'X', termsType: 'Y' })).to.throw(/transition type/);
      });
    });
  });

  describe('#validate', () => {
    context('when all required params are present', () => {
      it('does not throw', () => {
        subject = new Run(VALID_PARAMS);
        expect(subject.validate.bind(subject)).to.not.throw();
      });
    });

    [ 'runId', 'collectionId', 'startDate', 'engineVersion', 'declarationsCommit' ].forEach(requiredParam => {
      describe(`"${requiredParam}"`, () => {
        context('when missing', () => {
          it('throws an error', () => {
            subject = new Run({ ...VALID_PARAMS, [requiredParam]: undefined });
            expect(subject.validate.bind(subject)).to.throw(RegExp(requiredParam));
          });
        });
      });
    });

    context('when lastRun.status is not a valid value', () => {
      it('throws an error', () => {
        subject = new Run(VALID_PARAMS);
        subject.lastRun.status = 'unknown';
        expect(subject.validate.bind(subject)).to.throw(/status/);
      });
    });

    context('when runId does not match the expected format', () => {
      it('throws an error', () => {
        subject = new Run({ ...VALID_PARAMS, runId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });
        expect(subject.validate.bind(subject)).to.throw(/runId/);
      });
    });

    context('when lastRun is replaced with null after construction', () => {
      it('throws on the first required field resolved through lastRun', () => {
        subject = new Run(VALID_PARAMS);
        subject.lastRun = null;
        expect(subject.validate.bind(subject)).to.throw(/startDate/);
      });
    });

    context('when declarations is replaced with null after construction', () => {
      it('throws on the first required field resolved through declarations', () => {
        subject = new Run(VALID_PARAMS);
        subject.declarations = null;
        expect(subject.validate.bind(subject)).to.throw(/declarationsCommit/);
      });
    });
  });
});
