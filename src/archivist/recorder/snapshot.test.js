import chai from 'chai';

import Snapshot from './snapshot.js';

const { expect } = chai;

describe('Snapshot', () => {
  let subject;

  describe('#validate', () => {
    Snapshot.REQUIRED_PARAMS.forEach(requiredParam => {
      const validParamsExceptTheOneTested = Snapshot.REQUIRED_PARAMS.filter(paramName => paramName != requiredParam).reduce(
        (accumulator, currentValue) => {
          accumulator[currentValue] = 'non null value';

          return accumulator;
        },
        {},
      );

      describe(`"${requiredParam}"`, () => {
        context('when missing', () => {
          it('throws an error', async () => {
            subject = new Snapshot({ ...validParamsExceptTheOneTested });
            expect(subject.validate.bind(subject)).to.throw(RegExp(requiredParam));
          });
        });

        context('when null', () => {
          it('throws an error', async () => {
            subject = new Snapshot({ ...validParamsExceptTheOneTested, [requiredParam]: null });
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
      mimeType: 'text/html',
      fetchDate: new Date('2000-01-01T12:00:00.000Z'),
    };

    before(async () => {
      subject = new Snapshot(recordParams);
    });

    context('when it is neither defined nor loaded', () => {
      it('throws an error explaining how to recover', async () => {
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
