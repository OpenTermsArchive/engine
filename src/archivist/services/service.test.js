import chai from 'chai';

import Service from './service.js';
import Terms from './terms.js';

const { expect } = chai;

describe('Service', () => {
  let subject;
  const TERMS_OF_SERVICE_TYPE = 'Terms of Service';
  const PRIVACY_POLICY_TYPE = 'Privacy Policy';
  const IMPRINT_TYPE = 'Imprint';

  describe('#addTerms', () => {
    let terms;

    before(() => {
      subject = new Service({ id: 'serviceID', name: 'serviceName' });
      terms = new Terms({
        type: TERMS_OF_SERVICE_TYPE,
        service: subject,
      });
    });

    context('when terms have no validity date', () => {
      before(() => {
        subject.addTerms(terms);
      });

      it('adds the terms as the last valid terms', () => {
        expect(subject.getTerms({ type: TERMS_OF_SERVICE_TYPE })).to.deep.eql(terms);
      });
    });

    context('when terms have a validity date', () => {
      let expiredTerms;
      const VALIDITY_DATE = new Date('2020-07-22T11:30:21.000Z');

      before(() => {
        expiredTerms = new Terms({
          type: TERMS_OF_SERVICE_TYPE,
          service: subject,
          validUntil: VALIDITY_DATE,
        });
        subject.addTerms(expiredTerms);
        subject.addTerms(terms);
      });

      it('adds the terms with the proper validity date', () => {
        expect(subject.getTerms({ type: TERMS_OF_SERVICE_TYPE, date: VALIDITY_DATE })).to.deep.eql(expiredTerms);
      });
    });
  });

  describe('#getTerms', () => {
    let subject;

    const EARLIEST_DATE = '2020-06-21T11:30:21.000Z';
    const DATE = '2020-07-22T11:30:21.000Z';
    const LATEST_DATE = '2020-08-21T11:30:21.000Z';

    const firstTermsOfService = new Terms({ type: TERMS_OF_SERVICE_TYPE, validUntil: DATE });
    const firstPrivacyPolicy = new Terms({ type: 'Privacy Policy', validUntil: DATE });

    const latestTermsOfService = new Terms({ type: TERMS_OF_SERVICE_TYPE });
    const latestPrivacyPolicy = new Terms({ type: 'Privacy Policy' });

    const latestDeveloperTerms = new Terms({ type: 'Developer Terms' });

    before(() => {
      subject = new Service({ id: 'serviceID', name: 'serviceName' });
      subject.addTerms(firstTermsOfService);
      subject.addTerms(firstPrivacyPolicy);
      subject.addTerms(latestTermsOfService);
      subject.addTerms(latestPrivacyPolicy);
      subject.addTerms(latestDeveloperTerms);
    });

    context('when no params are given', () => {
      it('returns all latest terms', () => {
        expect(subject.getTerms()).to.deep.eql([ latestTermsOfService, latestPrivacyPolicy, latestDeveloperTerms ]);
      });
    });

    context('when a terms type is given', () => {
      context('when a date is given', () => {
        context('when the terms has no history', () => {
          it('returns the latest terms according to the given type', () => {
            expect(subject.getTerms({ type: 'Developer Terms', date: LATEST_DATE })).to.eql(latestDeveloperTerms);
          });
        });

        context('when the terms have a history', () => {
          it('returns the terms according to the given type and date', () => {
            expect(subject.getTerms({ type: TERMS_OF_SERVICE_TYPE, date: EARLIEST_DATE })).to.eql(firstTermsOfService);
          });

          context('when the given date is strictly equal to a terms validity date', () => {
            it('returns the terms according to the given type with the validity date equal to the given date', () => {
              expect(subject.getTerms({ type: TERMS_OF_SERVICE_TYPE, date: DATE })).to.eql(firstTermsOfService);
            });
          });
        });
      });

      context('without a given date', () => {
        it('returns the latest terms of given type', () => {
          expect(subject.getTerms({ type: TERMS_OF_SERVICE_TYPE })).to.eql(latestTermsOfService);
        });
      });
    });

    context('when only a date is given', () => {
      context('when there is no history', () => {
        it('returns all latest terms', () => {
          expect(subject.getTerms({ date: LATEST_DATE })).to.deep.eql([ latestTermsOfService, latestPrivacyPolicy, latestDeveloperTerms ]);
        });
      });

      context('when the terms have a history', () => {
        it('returns all the terms according to the given date', () => {
          expect(subject.getTerms({ date: EARLIEST_DATE })).to.deep.eql([ firstTermsOfService, firstPrivacyPolicy, latestDeveloperTerms ]);
        });

        context('when the given date is strictly equal to a terms validity date', () => {
          it('returns all the terms with the validity date equal to the given date', () => {
            expect(subject.getTerms({ date: DATE })).to.deep.eql([ firstTermsOfService, firstPrivacyPolicy, latestDeveloperTerms ]);
          });
        });
      });
    });
  });

  describe('#getTermsTypes', () => {
    let termsOfService;
    let privacyPolicy;

    before(() => {
      subject = new Service({ id: 'serviceID', name: 'serviceName' });

      termsOfService = new Terms({ type: TERMS_OF_SERVICE_TYPE });
      privacyPolicy = new Terms({ type: PRIVACY_POLICY_TYPE, validUntil: '2020-07-22T11:30:21.000Z' });

      subject.addTerms(termsOfService);
      subject.addTerms(privacyPolicy);
    });

    context('without any filter', () => {
      it('returns all service terms types', () => {
        expect(subject.getTermsTypes()).to.have.members([ TERMS_OF_SERVICE_TYPE, PRIVACY_POLICY_TYPE ]);
      });
    });

    context('with a filter', () => {
      it('returns filtered terms types', () => {
        expect(subject.getTermsTypes([ PRIVACY_POLICY_TYPE, IMPRINT_TYPE ])).to.deep.equal([PRIVACY_POLICY_TYPE]);
      });
    });
  });

  describe('#getNumberOfTerms', () => {
    before(() => {
      subject = new Service({ id: 'serviceID', name: 'serviceName' });
      subject.addTerms(new Terms({ type: TERMS_OF_SERVICE_TYPE }));
      subject.addTerms(new Terms({ type: PRIVACY_POLICY_TYPE }));
    });

    context('without any filter', () => {
      it('returns the number of all terms types', () => {
        expect(subject.getNumberOfTerms()).to.equal(2);
      });
    });

    context('with a filter', () => {
      it('returns the number of filtered terms types', () => {
        expect(subject.getNumberOfTerms([ TERMS_OF_SERVICE_TYPE, IMPRINT_TYPE ])).to.equal(1);
      });
    });
  });
});
