import chai from 'chai';
import config from 'config';

import Record from './record.js';
import RepositoryFactory from './repositories/factory.js';

const { expect } = chai;

describe('Record', () => {
  let repository;
  let record;

  before(async () => {
    repository = await (RepositoryFactory.create(config.get('recorder.versions.storage'))).initialize();
    await repository.save(new Record({
      serviceId: 'ServiceA',
      documentType: 'Terms of Service',
      mimeType: 'text/html',
      fetchDate: new Date('2000-01-01T12:00:00.000Z'),
      content: 'content',
    }));
    ([record] = await repository.findAll());
  });

  after(async () => {
    await repository.removeAll();
    await repository.finalize();
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
