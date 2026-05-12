import { expect } from 'chai';

import Version from './version.js';

describe('Version', () => {
  let subject;

  describe('#validate', () => {
    Version.REQUIRED_PARAMS.forEach(requiredParam => {
      const validParamsExceptTheOneTested = Version.REQUIRED_PARAMS.filter(paramName => paramName != requiredParam).reduce(
        (accumulator, currentValue) => {
          accumulator[currentValue] = 'non null value';

          return accumulator;
        },
        {},
      );

      describe(`"${requiredParam}"`, () => {
        context('when missing', () => {
          it('throws an error', () => {
            subject = new Version({ ...validParamsExceptTheOneTested });
            expect(subject.validate.bind(subject)).to.throw(RegExp(requiredParam));
          });
        });

        context('when null', () => {
          it('throws an error', () => {
            subject = new Version({ ...validParamsExceptTheOneTested, [requiredParam]: null });
            expect(subject.validate.bind(subject)).to.throw(RegExp(requiredParam));
          });
        });
      });
    });
  });

  describe('Content access', () => {
    const recordParams = {
      serviceId: 'ServiceA',
      termsType: 'Terms of Service',
      fetchDate: new Date('2000-01-01T12:00:00.000Z'),
      snapshotIds: ['dd263f270b3065e1c18201b49ab898474b357566'],
    };

    before(() => {
      subject = new Version(recordParams);
    });

    context('when it is neither defined nor loaded', () => {
      it('throws an error explaining how to recover', () => {
        try {
          console.log(subject.content);
        } catch (e) {
          expect(e).to.be.an('error');
          expect(e.message).to.have.string('set the content or use Repository#loadRecordContent');

          return;
        }
        expect.fail('No error was thrown');
      });
    });
  });

  describe('#displayTitle', () => {
    const baseParams = {
      serviceId: 'service-A',
      termsType: 'Terms of Service',
      fetchDate: new Date('2000-01-01T12:00:00.000Z'),
      content: 'some content',
      snapshotIds: ['dd263f270b3065e1c18201b49ab898474b357566'],
    };

    context('when the record is the first one for its service and terms type', () => {
      it('starts with the first-record prefix', () => {
        subject = new Version({ ...baseParams, isFirstRecord: true });
        expect(subject.displayTitle).to.equal('First record of service-A Terms of Service');
      });
    });

    context('when the record is a technical upgrade', () => {
      it('starts with the technical-upgrade prefix', () => {
        subject = new Version({ ...baseParams, isTechnicalUpgrade: true });
        expect(subject.displayTitle).to.equal('Apply technical or declaration upgrade on service-A Terms of Service');
      });
    });

    context('when the record is a regular content change', () => {
      it('starts with the update prefix', () => {
        subject = new Version(baseParams);
        expect(subject.displayTitle).to.equal('Record new changes of service-A Terms of Service');
      });
    });

    context('when the record is both a first record and a technical upgrade', () => {
      it('prioritises the first-record prefix', () => {
        subject = new Version({ ...baseParams, isFirstRecord: true, isTechnicalUpgrade: true });
        expect(subject.displayTitle).to.equal('First record of service-A Terms of Service');
      });
    });
  });
});
