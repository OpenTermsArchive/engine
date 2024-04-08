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
  serviceAMultipleTermsUpdated: { path: './fixtures/serviceAMultipleTermsUpdated.json' },
  serviceATermsAdded: { path: './fixtures/serviceATermsAdded.json' },
  serviceATermsRemoved: { path: './fixtures/serviceATermsRemoved.json' },
  serviceB: { path: './fixtures/serviceB.json' },
};

const COMMIT_PATHS = {
  serviceA: './declarations/ServiceA.json',
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

describe.only('DeclarationUtils', () => {
  describe('#getModifiedServicesAndTermsTypes', () => {
    before(async () => {
      await loadFixtures();
      await setupRepository();
    });

    after(() => fs.rm(SUBJECT_PATH, { recursive: true }));

    context('when an existing declaration has been modified', () => {
      before(() => commitChanges(COMMIT_PATHS.serviceA, FIXTURES.serviceATermsUpdated.content));
      after(removeLatestCommit);

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
      before(() => removeLatestCommit(declarationUtils.git));
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
