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
        expect(subject.getTerms({ type: TERMS_TYPE })).to.deep.eql(terms);
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
        expect(subject.getTerms({ type: TERMS_TYPE, date: VALIDITY_DATE })).to.deep.eql(expiredTerms);
      });
    });
  });

  describe('#getTerms', () => {
    let subject;

    const firstDate = '2020-07-22T11:30:21.000Z';

    const firstTermsOfService = new Terms({ type: TERMS_TYPE, validUntil: firstDate });
    const firstPrivacyPolicy = new Terms({ type: 'Privacy Policy', validUntil: firstDate });

    const latestTermsOfService = new Terms({ type: TERMS_TYPE });
    const latestPrivacyPolicy = new Terms({ type: 'Privacy Policy' });

    const latestDeveloperTerms = new Terms({ type: 'Developer Terms' });

    before(async () => {
      subject = new Service({ id: 'serviceID', name: 'serviceName' });
      subject.addTerms(firstTermsOfService);
      subject.addTerms(firstPrivacyPolicy);
      subject.addTerms(latestTermsOfService);
      subject.addTerms(latestPrivacyPolicy);
      subject.addTerms(latestDeveloperTerms);
    });

    context('when no params are given', () => {
      it('returns all latest terms', async () => {
        expect(subject.getTerms()).to.deep.eql([ latestTermsOfService, latestPrivacyPolicy, latestDeveloperTerms ]);
      });
    });

    context('when a terms type is given', () => {
      context('when a date is given', () => {
        context('when the terms has no history', () => {
          it('returns the last terms according to the given type', async () => {
            expect(subject.getTerms({ type: 'Developer Terms', date: '2020-08-21T11:30:21.000Z' })).to.eql(latestDeveloperTerms);
          });
        });

        context('when the terms have a history', () => {
          it('returns the terms according to the given type and date', async () => {
            expect(subject.getTerms({ type: TERMS_TYPE, date: '2020-06-21T11:30:21.000Z' })).to.eql(firstTermsOfService);
          });

          context('when the given date is strictly equal to a terms validity date', () => {
            it('returns the terms according to the given type with the validity date equal to the given date', async () => {
              expect(subject.getTerms({ type: TERMS_TYPE, date: firstDate })).to.eql(firstTermsOfService);
            });
          });
        });
      });

      context('without a given date', () => {
        it('returns the last terms according to the given type', async () => {
          expect(subject.getTerms({ type: TERMS_TYPE })).to.eql(latestTermsOfService);
        });
      });
    });

    context('when only a date is given', () => {
      context('when there is no history', () => {
        it('returns all last terms', async () => {
          expect(subject.getTerms({ date: '2020-08-21T11:30:21.000Z' })).to.deep.eql([ latestTermsOfService, latestPrivacyPolicy, latestDeveloperTerms ]);
        });
      });

      context('when the terms have a history', () => {
        it('returns all the terms according to the given date', async () => {
          expect(subject.getTerms({ date: '2020-06-21T11:30:21.000Z' })).to.deep.eql([ firstTermsOfService, firstPrivacyPolicy, latestDeveloperTerms ]);
        });

        context('when the given date is strictly equal to a terms validity date', () => {
          it('returns all the terms with the validity date equal to the given date', async () => {
            expect(subject.getTerms({ date: firstDate })).to.deep.eql([ firstTermsOfService, firstPrivacyPolicy, latestDeveloperTerms ]);
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
