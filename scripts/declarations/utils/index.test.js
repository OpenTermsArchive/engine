import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { expect } from 'chai';

import DeclarationUtils from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let declarationUtils;

const SUBJECT_PATH = path.resolve(__dirname, './test');

const FIXTURES = {
  serviceA: { path: './fixtures/serviceA.json' },
  serviceATermsUpdated: { path: './fixtures/serviceATermsUpdated.json' },
  serviceATermsUpdatedHistory: { path: './fixtures/serviceATermsUpdated.history.json' },
  serviceAMultipleTermsUpdated: { path: './fixtures/serviceAMultipleTermsUpdated.json' },
  serviceATermsAdded: { path: './fixtures/serviceATermsAdded.json' },
  serviceATermsRemoved: { path: './fixtures/serviceATermsRemoved.json' },
  serviceB: { path: './fixtures/serviceB.json' },
};

const COMMIT_PATHS = {
  serviceA: './declarations/ServiceA.json',
  serviceAHistory: './declarations/ServiceA.history.json',
  serviceB: './declarations/ServiceB.json',
};

const commitChanges = async (filePath, content) => {
  await fs.writeFile(path.resolve(SUBJECT_PATH, filePath), JSON.stringify(content, null, 2));
  await declarationUtils.git.add(filePath);
  await declarationUtils.git.commit('Update declarations', filePath);
};

const removeLatestCommit = async () => {
  await declarationUtils.git.reset('hard', ['HEAD~1']);
};

describe('DeclarationUtils', () => {
  describe('#getServiceIdFromFilePath', () => {
    it('extracts service ID from regular file path', () => {
      expect(DeclarationUtils.getServiceIdFromFilePath('declarations/ServiceA.json')).to.equal('ServiceA');
    });

    it('extracts service ID from history file path', () => {
      expect(DeclarationUtils.getServiceIdFromFilePath('declarations/ServiceA.history.json')).to.equal('ServiceA');
    });

    it('extracts service ID from filters file path', () => {
      expect(DeclarationUtils.getServiceIdFromFilePath('declarations/ServiceA.filters.js')).to.equal('ServiceA');
    });

    it('extracts service ID from filters history file path', () => {
      expect(DeclarationUtils.getServiceIdFromFilePath('declarations/ServiceA.filters.history.js')).to.equal('ServiceA');
    });
  });

  describe('#getModifiedServicesAndTermsTypes', () => {
    before(async () => {
      await loadFixtures();
      await setupRepository();
    });

    after(() => fs.rm(SUBJECT_PATH, { recursive: true }));

    context('when an existing declaration has been modified', () => {
      before(async () => {
        await commitChanges(COMMIT_PATHS.serviceA, FIXTURES.serviceATermsUpdated.content);
        await commitChanges(COMMIT_PATHS.serviceAHistory, FIXTURES.serviceATermsUpdatedHistory.content);
      });
      after(async () => {
        await removeLatestCommit();
        await removeLatestCommit();
      });

      it('returns the service ID and the updated terms type', async () => {
        expect(await declarationUtils.getModifiedServicesAndTermsTypes()).to.deep.equal({
          services: ['ServiceA'],
          servicesTermsTypes: { ServiceA: ['Terms of Service'] },
        });
      });
    });

    context('when new terms are declared in an existing declaration', () => {
      before(() => commitChanges(COMMIT_PATHS.serviceA, FIXTURES.serviceATermsAdded.content));
      after(removeLatestCommit);

      it('returns the service ID and the added terms type', async () => {
        expect(await declarationUtils.getModifiedServicesAndTermsTypes()).to.deep.equal({
          services: ['ServiceA'],
          servicesTermsTypes: { ServiceA: ['Imprint'] },
        });
      });
    });

    context('when a new declaration has been added', () => {
      before(() => commitChanges(COMMIT_PATHS.serviceB, FIXTURES.serviceB.content));
      after(removeLatestCommit);

      it('returns the added service ID along with the associated terms type', async () => {
        expect(await declarationUtils.getModifiedServicesAndTermsTypes()).to.deep.equal({
          services: ['ServiceB'],
          servicesTermsTypes: { ServiceB: ['Terms of Service'] },
        });
      });
    });

    context('when a declaration has been removed', () => {
      before(removeLatestCommit);
      after(async () => {
        await fs.mkdir(path.resolve(SUBJECT_PATH, './declarations'), { recursive: true });
        await commitChanges(COMMIT_PATHS.serviceA, FIXTURES.serviceA.content);
      });

      it('returns no services and no terms types', async () => {
        expect(await declarationUtils.getModifiedServicesAndTermsTypes()).to.deep.equal({
          services: [],
          servicesTermsTypes: {},
        });
      });
    });

    context('when terms are removed from an existing declaration', () => {
      before(() => commitChanges(COMMIT_PATHS.serviceA, FIXTURES.serviceATermsRemoved.content));
      after(removeLatestCommit);

      it('returns no services and no terms types', async () => {
        expect(await declarationUtils.getModifiedServicesAndTermsTypes()).to.deep.equal({
          services: [],
          servicesTermsTypes: {},
        });
      });
    });

    context('when there is a combination of an updated declaration and an added declaration', () => {
      before(async () => {
        await commitChanges(COMMIT_PATHS.serviceA, FIXTURES.serviceAMultipleTermsUpdated.content);
        await commitChanges(COMMIT_PATHS.serviceB, FIXTURES.serviceB.content);
      });

      after(async () => {
        await removeLatestCommit();
        await removeLatestCommit();
      });

      it('returns the services IDs and the updated terms types', async () => {
        expect(await declarationUtils.getModifiedServicesAndTermsTypes()).to.deep.equal({
          services: [ 'ServiceA', 'ServiceB' ],
          servicesTermsTypes: {
            ServiceA: [ 'Imprint', 'Privacy Policy', 'Terms of Service' ],
            ServiceB: ['Terms of Service'],
          },
        });
      });
    });

    context('when filters file is modified', () => {
      before(async () => {
        await fs.writeFile(path.resolve(SUBJECT_PATH, './declarations/ServiceA.filters.js'), 'module.exports = {};');
        await declarationUtils.git.add('./declarations/ServiceA.filters.js');
        await declarationUtils.git.commit('Add filters file', './declarations/ServiceA.filters.js');
      });
      after(removeLatestCommit);

      it('returns all terms types from the service declaration', async () => {
        const result = await declarationUtils.getModifiedServicesAndTermsTypes();

        expect(result.services).to.include('ServiceA');
        expect(result.servicesTermsTypes.ServiceA).to.have.members([ 'Privacy Policy', 'Terms of Service' ]);
      });
    });

    context('when filters history file is modified', () => {
      before(async () => {
        await fs.writeFile(path.resolve(SUBJECT_PATH, './declarations/ServiceA.filters.history.js'), 'module.exports = {};');
        await declarationUtils.git.add('./declarations/ServiceA.filters.history.js');
        await declarationUtils.git.commit('Add filters history file', './declarations/ServiceA.filters.history.js');
      });
      after(removeLatestCommit);

      it('returns all terms types from the service declaration', async () => {
        const result = await declarationUtils.getModifiedServicesAndTermsTypes();

        expect(result.services).to.include('ServiceA');
        expect(result.servicesTermsTypes.ServiceA).to.have.members([ 'Privacy Policy', 'Terms of Service' ]);
      });
    });

    context('when history file is modified without declaration changes', () => {
      before(() => commitChanges(COMMIT_PATHS.serviceAHistory, FIXTURES.serviceATermsUpdatedHistory.content));
      after(removeLatestCommit);

      it('returns no services and no terms types', async () => {
        expect(await declarationUtils.getModifiedServicesAndTermsTypes()).to.deep.equal({
          services: [],
          servicesTermsTypes: {},
        });
      });
    });
  });
});

async function loadFixtures() {
  await Promise.all(Object.values(FIXTURES).map(async fixture => {
    const content = await fs.readFile(path.resolve(__dirname, fixture.path), 'utf-8');

    fixture.content = JSON.parse(content);
  }));
}

async function setupRepository() {
  await fs.mkdir(path.resolve(SUBJECT_PATH, './declarations'), { recursive: true });

  declarationUtils = new DeclarationUtils(SUBJECT_PATH, 'main');
  await declarationUtils.git.init();
  await declarationUtils.git.addConfig('user.name', 'Open Terms Archive Testing Bot');
  await declarationUtils.git.addConfig('user.email', 'testing-bot@opentermsarchive.org');
  await declarationUtils.git.checkoutLocalBranch('main');
  await commitChanges('./README.md', 'This directory is auto-generated by test executions and requires cleanup after each test run');
  await commitChanges(COMMIT_PATHS.serviceA, FIXTURES.serviceA.content);
  await declarationUtils.git.checkoutLocalBranch('updated');
}
