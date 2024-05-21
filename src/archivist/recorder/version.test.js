import chai from 'chai';

import Version from './version.js';

const { expect } = chai;

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
});
