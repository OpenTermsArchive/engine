import chai from 'chai';
import config from 'config';

import Record from './record.js';
import RepositoryFactory from './repositories/factory.js';

const { expect } = chai;

describe('Record', () => {
  let repository;
  let record;
  const REQUIRED_PARAMS = [ 'serviceId', 'documentType', 'mimeType', 'fetchDate' ];
  const recordParams = {
    serviceId: 'ServiceA',
    documentType: 'Terms of Service',
    mimeType: 'text/html',
    fetchDate: new Date('2000-01-01T12:00:00.000Z'),
  };

  describe('Validation', () => {
    describe('Required paramaters', () => {
      REQUIRED_PARAMS.forEach(requiredParam => {
        describe(`"${requiredParam}"`, () => {
          context('when it is missing', () => {
            it('throws an error', async () => {
              try {
                const params = {};

                Object.keys(recordParams).filter(param => param != requiredParam).forEach(param => {
                  params[param] = recordParams[param];
                });

                record = new Record({ ...params });
              } catch (e) {
                expect(e).to.be.an('error');
                expect(e.message).to.have.string(`"${requiredParam}" is required`);

                return;
              }
              expect.fail('No error was thrown');
            });
          });

          context('when it is null', () => {
            it('throws an error', async () => {
              try {
                record = new Record({ ...recordParams, [requiredParam]: null });
              } catch (e) {
                expect(e).to.be.an('error');
                expect(e.message).to.have.string(`"${requiredParam}" is required`);

                return;
              }
              expect.fail('No error was thrown');
            });
          });
        });
      });
    });
  });

  context('when trying to access content and it is neither defined nor loaded', () => {
    it('throws an error explaining how to recover', async () => {
      try {
        console.log(record.content);
      } catch (e) {
        expect(e).to.be.an('error');
        expect(e.message).to.have.string('set the content or use Repository#loadRecordContent');

        return;
      }
      expect.fail('No error was thrown');
    });
  });
});
