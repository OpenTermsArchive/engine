import chai from 'chai';

import Service from './service.js';
import Terms from './terms.js';

const { expect } = chai;

describe('Service', () => {
  let subject;
  const TERMS_TYPE = 'Terms of Service';

  describe('#addTerms', () => {
    let terms;

    before(async () => {
      terms = new Terms({
        type: TERMS_TYPE,
        service: subject,
      });
    });

    context('when terms has no validity date', () => {
      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        subject.addTerms(terms);
      });

      it('adds the terms as the last valid terms', async () => {
        expect(subject.getTerms(TERMS_TYPE)).to.deep.eql(terms);
      });
    });

    context('when terms has a validity date', () => {
      let expiredTerms;
      const VALIDITY_DATE = new Date('2020-07-22T11:30:21.000Z');

      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        expiredTerms = new Terms({
          type: TERMS_TYPE,
          service: subject,
          validUntil: VALIDITY_DATE,
        });
        subject.addTerms(expiredTerms);
        subject.addTerms(terms);
      });

      it('adds the terms with the proper validity date', async () => {
        expect(subject.getTermsAtDate(TERMS_TYPE, VALIDITY_DATE)).to.deep.eql(expiredTerms);
      });
    });
  });

  describe('#getTerms', () => {
    let subject;

    const termsOfService = new Terms({ type: TERMS_TYPE });
    const privacyPolicy = new Terms({ type: 'Privacy Policy' });

    before(async () => {
      subject = new Service({ id: 'serviceID', name: 'serviceName' });
      subject.addTerms(termsOfService);
      subject.addTerms(privacyPolicy);
    });

    it('returns all terms', async () => {
      expect(subject.getTerms()).to.deep.eql([
        termsOfService,
        privacyPolicy,
      ]);
    });

    context('when a terms type is given', () => {
      it('returns the terms of that type', async () => {
        expect(subject.getTerms(TERMS_TYPE)).to.eql(termsOfService);
      });
    });
  });

  describe('#getTermsAtDate', () => {
    let subject;

    const last = new Terms({ type: TERMS_TYPE });

    context('when there is no history', () => {
      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        subject.addTerms(last);
      });

      context('without given date', () => {
        it('returns the last terms', async () => {
          expect(subject.getTermsAtDate(TERMS_TYPE)).to.eql(last);
        });
      });

      context('with a date', () => {
        it('returns the last terms', async () => {
          expect(subject.getTermsAtDate(TERMS_TYPE, '2020-08-21T11:30:21.000Z')).to.eql(last);
        });
      });
    });

    context('when the terms have a history', () => {
      const first = new Terms({
        type: TERMS_TYPE,
        validUntil: '2020-07-22T11:30:21.000Z',
      });

      const second = new Terms({
        type: TERMS_TYPE,
        validUntil: '2020-08-22T11:30:21.000Z',
      });

      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        subject.addTerms(last);
        subject.addTerms(first);
        subject.addTerms(second);
      });

      context('without given date', () => {
        it('returns the last terms', async () => {
          expect(subject.getTermsAtDate(TERMS_TYPE)).to.eql(last);
        });
      });

      context('with a date', () => {
        it('returns the terms according to the given date', async () => {
          expect(subject.getTermsAtDate(TERMS_TYPE, '2020-08-21T11:30:21.000Z')).to.eql(second);
        });

        context('strictly equal to a terms validity date', () => {
          it('returns the terms with the validity date equal to the given date', async () => {
            expect(subject.getTermsAtDate(TERMS_TYPE, second.validUntil)).to.eql(second);
          });
        });
      });
    });
  });

  describe('#getTermsTypes', () => {
    let subject;
    let termsOfService;
    let privacyPolicy;

    before(async () => {
      subject = new Service({ id: 'serviceID', name: 'serviceName' });

      termsOfService = new Terms({ type: TERMS_TYPE });

      privacyPolicy = new Terms({
        type: 'Privacy Policy',
        validUntil: '2020-07-22T11:30:21.000Z',
      });

      subject.addTerms(termsOfService);
      subject.addTerms(privacyPolicy);
    });

    it('returns the service terms types', async () => {
      expect(subject.getTermsTypes()).to.have.members([
        termsOfService.type,
        privacyPolicy.type,
      ]);
    });
  });
});
