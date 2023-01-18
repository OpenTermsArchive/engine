import chai from 'chai';
import config from 'config';

import Record from './record.js';
import RepositoryFactory from './repositories/factory.js';

const { expect } = chai;

describe('Record', () => {
  let repository;
  let subject;
  const REQUIRED_PARAMS = [ 'serviceId', 'termsType', 'mimeType', 'fetchDate' ];
  const recordParams = {
    serviceId: 'ServiceA',
    termsType: 'Terms of Service',
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

                subject = new Record({ ...params });
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
                subject = new Record({ ...recordParams, [requiredParam]: null });
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

  describe('Content access', () => {
    before(async () => {
      repository = await RepositoryFactory.create(config.get('recorder.versions.storage')).initialize();
      await repository.save(new Record({
        ...recordParams,
        content: 'content',
      }));
      ([subject] = await repository.findAll());
    });

    after(async () => {
      await repository.removeAll();
      await repository.finalize();
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
