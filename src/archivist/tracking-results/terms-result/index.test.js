import { expect } from 'chai';

import TermsResult from './index.js';

const VALID_PARAMS = {
  serviceId: 'Google',
  termsType: 'Terms of Service',
  status: 'ok',
  event: {
    date: '2026-01-10T10:30:00Z',
    serviceName: 'Google',
    sourceDocuments: [{
      id: 'terms',
      fetch: 'https://policies.google.com/terms',
      select: '.content',
      remove: '.banner',
      filter: ['removeLinks'],
      executeClientScripts: false,
      mimeType: 'text/html',
      snapshotId: 'def456',
    }],
  },
};

describe('TermsResult', () => {
  let subject;

  describe('#constructor', () => {
    it('normalises params to their JSON round-trip, dropping undefined-valued keys', () => {
      subject = new TermsResult({
        ...VALID_PARAMS,
        event: {
          ...VALID_PARAMS.event,
          sourceDocuments: [{
            id: 'terms',
            fetch: 'https://policies.google.com/terms',
            select: '.content',
            remove: undefined,
            filter: undefined,
          }],
        },
      });

      expect(subject.event.sourceDocuments[0]).to.deep.equal({
        id: 'terms',
        fetch: 'https://policies.google.com/terms',
        select: '.content',
      });
      expect(subject.event.sourceDocuments[0]).to.not.have.property('remove');
      expect(subject.event.sourceDocuments[0]).to.not.have.property('filter');
    });
  });

  describe('#validate', () => {
    context('when all required params are present', () => {
      it('does not throw', () => {
        subject = new TermsResult(VALID_PARAMS);
        expect(subject.validate.bind(subject)).to.not.throw();
      });
    });

    [ 'serviceId', 'termsType', 'status', 'event' ].forEach(requiredParam => {
      describe(`"${requiredParam}"`, () => {
        context('when missing', () => {
          it('throws an error', () => {
            const params = { ...VALID_PARAMS };

            delete params[requiredParam];
            subject = new TermsResult(params);
            expect(subject.validate.bind(subject)).to.throw(RegExp(requiredParam));
          });
        });

        context('when null', () => {
          it('throws an error', () => {
            subject = new TermsResult({ ...VALID_PARAMS, [requiredParam]: null });
            expect(subject.validate.bind(subject)).to.throw(RegExp(requiredParam));
          });
        });
      });
    });

    describe('"status"', () => {
      context('when not a valid value', () => {
        it('throws an error', () => {
          subject = new TermsResult({ ...VALID_PARAMS, status: 'unknown' });
          expect(subject.validate.bind(subject)).to.throw(/status/);
        });
      });

      [ 'ok', 'failed' ].forEach(validStatus => {
        context(`when set to "${validStatus}"`, () => {
          it('does not throw', () => {
            const params = { ...VALID_PARAMS, status: validStatus };

            if (validStatus === 'failed') {
              params.event = { ...VALID_PARAMS.event, reasons: ['[fetch] HTTP code 503'] };
            }

            subject = new TermsResult(params);
            expect(subject.validate.bind(subject)).to.not.throw();
          });
        });
      });
    });

    describe('"event.date"', () => {
      context('when missing', () => {
        it('throws an error', () => {
          subject = new TermsResult({ ...VALID_PARAMS, event: { ...VALID_PARAMS.event, date: undefined } });
          expect(subject.validate.bind(subject)).to.throw(/event\.date/);
        });
      });
    });

    describe('"event.serviceName"', () => {
      context('when missing', () => {
        it('throws an error', () => {
          subject = new TermsResult({ ...VALID_PARAMS, event: { ...VALID_PARAMS.event, serviceName: undefined } });
          expect(subject.validate.bind(subject)).to.throw(/event\.serviceName/);
        });
      });
    });

    describe('"event.sourceDocuments"', () => {
      context('when not an array', () => {
        it('throws an error', () => {
          subject = new TermsResult({ ...VALID_PARAMS, event: { ...VALID_PARAMS.event, sourceDocuments: 'not-an-array' } });
          expect(subject.validate.bind(subject)).to.throw(/event\.sourceDocuments/);
        });
      });
    });

    describe('"event.reasons" when status is "failed"', () => {
      context('when missing', () => {
        it('throws an error', () => {
          subject = new TermsResult({ ...VALID_PARAMS, status: 'failed' });
          expect(subject.validate.bind(subject)).to.throw(/event\.reasons/);
        });
      });

      context('when empty', () => {
        it('throws an error', () => {
          subject = new TermsResult({ ...VALID_PARAMS, status: 'failed', event: { ...VALID_PARAMS.event, reasons: [] } });
          expect(subject.validate.bind(subject)).to.throw(/event\.reasons/);
        });
      });

      context('when non-empty', () => {
        it('does not throw', () => {
          subject = new TermsResult({
            ...VALID_PARAMS,
            status: 'failed',
            event: { ...VALID_PARAMS.event, reasons: ['[fetch] HTTP code 503'] },
          });
          expect(subject.validate.bind(subject)).to.not.throw();
        });
      });
    });

    describe('"event.transientError"', () => {
      context('when present but reasons is empty', () => {
        it('throws an error', () => {
          subject = new TermsResult({
            ...VALID_PARAMS,
            event: { ...VALID_PARAMS.event, transientError: { reasons: [] } },
          });
          expect(subject.validate.bind(subject)).to.throw(/transientError/);
        });
      });

      context('when present but reasons is missing (non-object with a truthy value)', () => {
        it('throws an error', () => {
          subject = new TermsResult({
            ...VALID_PARAMS,
            event: { ...VALID_PARAMS.event, transientError: 'not-an-object' }, // Scalar truthy value has no .reasons array
          });
          expect(subject.validate.bind(subject)).to.throw(/transientError/);
        });
      });

      context('when present but reasons is not an array', () => {
        it('throws an error', () => {
          subject = new TermsResult({
            ...VALID_PARAMS,
            event: { ...VALID_PARAMS.event, transientError: { reasons: 'a-string' } },
          });
          expect(subject.validate.bind(subject)).to.throw(/transientError/);
        });
      });

      context('when present with non-empty reasons', () => {
        it('does not throw', () => {
          subject = new TermsResult({
            ...VALID_PARAMS,
            event: { ...VALID_PARAMS.event, transientError: { reasons: ['[fetch] HTTP code 503'] } },
          });
          expect(subject.validate.bind(subject)).to.not.throw();
        });
      });
    });

    describe('"status"', () => {
      context('when the value is the right type but wrong case ("OK" instead of "ok")', () => {
        it('throws an error', () => {
          subject = new TermsResult({ ...VALID_PARAMS, status: 'OK' });
          expect(subject.validate.bind(subject)).to.throw(/status/);
        });
      });
    });

    describe('"event.sourceDocuments"', () => {
      context('when null', () => {
        it('throws an error', () => {
          subject = new TermsResult({ ...VALID_PARAMS, event: { ...VALID_PARAMS.event, sourceDocuments: null } });
          expect(subject.validate.bind(subject)).to.throw(/event\.sourceDocuments/);
        });
      });

      context('when an empty array', () => {
        it('does not throw', () => {
          subject = new TermsResult({ ...VALID_PARAMS, event: { ...VALID_PARAMS.event, sourceDocuments: [] } });
          expect(subject.validate.bind(subject)).to.not.throw();
        });
      });
    });
  });
});
