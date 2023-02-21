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
        termsType: TERMS_TYPE,
        service: subject,
      });
    });

    context('when terms declaration has no validity date', () => {
      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        subject.addTerms(terms);
      });

      it('adds the terms as the last valid terms declaration', async () => {
        expect(subject.getTerms(TERMS_TYPE)).to.deep.eql(terms);
      });
    });

    context('when terms declaration has a validity date', () => {
      let expiredTerms;
      const VALIDITY_DATE = new Date('2020-07-22T11:30:21.000Z');

      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        expiredTerms = new Terms({
          termsType: TERMS_TYPE,
          service: subject,
          validUntil: VALIDITY_DATE,
        });
        subject.addTerms(expiredTerms);
        subject.addTerms(terms);
      });

      it('adds the terms with the proper validity date', async () => {
        expect(subject.getTerms(TERMS_TYPE, VALIDITY_DATE)).to.deep.eql(expiredTerms);
      });
    });
  });

  describe('#getTerms', () => {
    let subject;

    const lastDeclaration = new Terms({ termsType: TERMS_TYPE });

    context('when there is no history', () => {
      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        subject.addTerms(lastDeclaration);
      });

      context('without given date', () => {
        it('returns the last terms declaration', async () => {
          expect(subject.getTerms(TERMS_TYPE)).to.eql(lastDeclaration);
        });
      });

      context('with a date', () => {
        it('returns the last terms declaration', async () => {
          expect(subject.getTerms(TERMS_TYPE, '2020-08-21T11:30:21.000Z')).to.eql(lastDeclaration);
        });
      });
    });

    context('when the terms has a history', () => {
      const firstDeclaration = new Terms({
        termsType: TERMS_TYPE,
        validUntil: '2020-07-22T11:30:21.000Z',
      });

      const secondDeclaration = new Terms({
        termsType: TERMS_TYPE,
        validUntil: '2020-08-22T11:30:21.000Z',
      });

      before(async () => {
        subject = new Service({ id: 'serviceID', name: 'serviceName' });
        subject.addTerms(lastDeclaration);
        subject.addTerms(firstDeclaration);
        subject.addTerms(secondDeclaration);
      });

      context('without given date', () => {
        it('returns the last terms declaration', async () => {
          expect(subject.getTerms(TERMS_TYPE)).to.eql(lastDeclaration);
        });
      });

      context('with a date', () => {
        it('returns the terms declaration according to the given date', async () => {
          expect(subject.getTerms(TERMS_TYPE, '2020-08-21T11:30:21.000Z')).to.eql(secondDeclaration);
        });

        context('strictly equal to a terms declaration validity date', () => {
          it('returns the terms declaration with the validity date equal to the given date', async () => {
            expect(subject.getTerms(TERMS_TYPE, secondDeclaration.validUntil)).to.eql(secondDeclaration);
          });
        });
      });
    });
  });

  describe('#getTermsTypes', () => {
    let subject;
    let termsOfServiceDeclaration;
    let privacyPolicyDeclaration;

    before(async () => {
      subject = new Service({ id: 'serviceID', name: 'serviceName' });

      termsOfServiceDeclaration = new Terms({ termsType: TERMS_TYPE });

      privacyPolicyDeclaration = new Terms({
        termsType: 'Privacy Policy',
        validUntil: '2020-07-22T11:30:21.000Z',
      });

      subject.addTerms(termsOfServiceDeclaration);
      subject.addTerms(privacyPolicyDeclaration);
    });

    it('returns the service terms types', async () => {
      expect(subject.getTermsTypes()).to.have.members([
        termsOfServiceDeclaration.termsType,
        privacyPolicyDeclaration.termsType,
      ]);
    });
  });
});
