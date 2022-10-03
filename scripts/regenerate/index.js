import fsApi from 'fs';
import fs from 'fs/promises';
import os from 'node:os';
import path from 'path';
import { fileURLToPath } from 'url';

import colors from 'colors';
import { program } from 'commander';
import config from 'config';
import inquirer from 'inquirer';
import jsdom from 'jsdom';

import { InaccessibleContentError } from '../../src/archivist/errors.js';
import filter from '../../src/archivist/filter/exports.js';
import Record from '../../src/archivist/recorder/record.js';
import RepositoryFactory from '../../src/archivist/recorder/repositories/factory.js';
import * as services from '../../src/archivist/services/index.js';

const { JSDOM } = jsdom;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_OUTPUT = path.resolve(__dirname, 'output');
const SKIPPED_OUTPUT = path.join(ROOT_OUTPUT, 'skipped');
const TO_CHECK_OUTPUT = path.join(ROOT_OUTPUT, 'to-check');

program
  .name('regenerate')
  .description('Cleanup services declarations and regenerate versions history')
  .version('0.0.1');

program
  .option('-s, --serviceId [serviceId]', 'service ID of service to handle')
  .option('-d, --documentType [documentType]', 'document type to handle')
  .option('-i, --interactive', 'Enable interactive mode to validate each version and choose if snapshot should be skipped');

program.parse(process.argv);
const options = program.opts();

const contentSkippingRules = {
  YouTube: { 'Terms of Service': { 'h1.title': 'Terms of Service' } },
  Instagram: {
    'Terms of Service': { 'h1 span': 'Terms of Use' },
    'Copyright Claims Policy': { '[role="main"] span:not(:empty)': 'Sorry! Something went wrong :(' },
  },
};

const selectorSkippingRules = {
  Facebook: {
    'Terms of Service': ['body.touch'],
    'Privacy Policy': ['body.touch'],
  },
  Instagram: {
    'Terms of Service': ['body.touch'],
    'Copyright Claims Policy': ['body.touch'],
    'Community Guidelines - Intellectual Property': ['body.touch'],
  },
};

const missingRequiredSelectorSkippingRules = {
  Facebook: {
    'Terms of Service': ['[href="https://www.facebook.com/legal/terms/eecc/flyout"]'],
    'Privacy Policy': ['[href*="https://www.facebook.com/help/contact/540977946302970"]'],
  },
  Instagram: {
    'Terms of Service': ['[href*="http://help.instagram.com/430517971668717"]'],
    'Copyright Claims Policy': ['[lang="fr"]'],
    'Privacy Policy': ['[href*="https://www.facebook.com/help/contact/540977946302970"]'],
  },
};

const snapshotsIdsWithContentToSkip = [
  '2ac6866668843e95d3244ef951aec80ac2a04d81',
  'cf212038db60cade3dc626b0c0bfa0050f937b3c',
  'e3c5d043231109859b20b6654a9b7386a6666482',
  '8440dae9d0332deb20c897d79f05ec13ba2ac56e',
  '4c7e6839f22f0e2c3337406dc2d5318122971443',
  'e58876806378bf5f97e114f0121f54ee44f10453',
  'd2ae49e6aa3b64b3ead538349a4a4e8d73bee58a',
  'b8ed9ebf5fa45d8884d4b427ed013ba81011ea53',
  '0d8cf493a4e2b6588c2a348a2c04191b605e867f',
  '654f583fa7f05094b83b9a2e89788697fafc0d7b',
  'a2e0702e3811d2058f11fb4e9804c5174cc9a759',
  '498e1a625f9c9c97d15e20428392d4e2ab64f938',
  '6c5f1aaaee985877fd583a8068cf87b52d176f79',
  '8cc9d13cddba1b4685a462e85c80ce0cf5dab175',
  'e727fc5d5ece297cf48f9ac3a5b608e1b30079d4',
  'cd20e0a866219a66a358b722a51bf668f433bbc4',
  '0ccc18b69f329f9b1621a42545f5bd111fe641a0',
  '39321b46fb9b834be114748198f0702448547fdc',
  '1c4ec7c73fef93084c077e75a21f5dac9c921370',
  '92e15535ff540b5652e5b3b0d1294de0f80f2302',
  'e6e468aa833da9f2b56f1190887eda7b817a35e7',
  'f30ddd1f6f1f59e6bc9e5d65465a9b94a9255976',
  '3f12b8f71b6ea942bc05ed316c420cfadb7abd0e',
  '6db14f8cf8191635d431936b34d971c1e35ca455',
  '2f3ecc3d57a1aaebe703961eab518b596a9b986b',
  '23c28b33f408bf2c60e6e72a948a6d5a5d68273d',
  '683d259252fe0f17c996085e077c55af4ccc1ffb',
  '589ef95adcda7fc64e9f3e562823ae338b651216',
  '9184bc42c5672c14d23e84708db936522588ab5b',
  '11779221c60f0cbddbe7831b228bdbf68f8e60bd',
  'fa7f59d3cd60afcefaf0b556d08986b96a99eafd',
  '80f5d1079c8d8e84a00201b1e3e42c14a07a58e5',
  '545087f8a6251e1b75cc72657f8f82d91e3de985',
  '09b2f505c8a81c599251165d4ae260b2d6fdff5d',
  'e9f342120f746def8cc003120999b70cad3bf789',
  '041ef83e663359d8ee2436ee43907a737f038f4c',
  '527d5e26ef2bea2cef2a148b76f967f6769b9048',
  '249e02ad7aad85be77ab4df396b00a59038e9891',
  'fe0c33f3a64e89d3f899753d1017360ab4412199',
  'c9388a9d9509c961acfae12918df13101c49f508',
  '9159d1cb40428f16c1fc21991de1b039bd203cbd',
];

const renamingRules = {
  'Community Guidelines - Child Sexual Exploitation': 'Community Guidelines - Child Exploitation',
  'Community Guidelines - Inauthentic Behaviour and Platform Manipulation': 'Community Guidelines - Platform Manipulation',
  'Community Guidelines - Deceased Users': 'Deceased Users',
  'Community Guidelines - Violent Incitement': 'Community Guidelines - Violence Incitement',
};

const genericPageDeclaration = {
  location: 'http://service.example',
  contentSelectors: 'html',
  filters: [document => {
    document.querySelectorAll('a').forEach(el => {
      const url = new URL(el.getAttribute('href'), document.location);

      url.search = '';
      el.setAttribute('href', url.toString());
    });
  }],
};

let servicesDeclarations = await services.loadWithHistory();

await initializeFolders(servicesDeclarations);

const { versionsRepository, snapshotsRepository } = await initializeRepositories();

const contentsToSkip = await initializeSnapshotContentToSkip(snapshotsIdsWithContentToSkip, snapshotsRepository);

info('Number of snapshot in the repository', await snapshotsRepository.count());

const serviceId = options.serviceId || '*';
const documentType = options.documentType || '*';

if (serviceId != '*' || documentType != '*') {
  info('Number of snapshot for the specified service', (await snapshotsRepository.findAll()).filter(s => s.serviceId == serviceId && s.documentType == documentType).length);
}

if (options.interactive) {
  info('Interactive mode enabled');
}

console.log('options', options);

let index = 1;

console.time('Total time');
for await (const snapshot of snapshotsRepository.iterate([`${serviceId}/${documentType}.*`])) {
  applyDocumentTypeRenaming(renamingRules, snapshot); // Modifies snapshot in place

  await handleSnapshot(snapshot, options, index);
  index++;
}
console.timeEnd('Total time');

await cleanupEmptyDirectories();

async function initializeFolders(servicesDeclarations) {
  return Promise.all([ TO_CHECK_OUTPUT, SKIPPED_OUTPUT ].map(async folder =>
    Promise.all(Object.entries(servicesDeclarations).map(([ key, value ]) =>
      Promise.all(Object.keys(value.documents).map(documentName => {
        const folderPath = path.join(folder, key, documentName);

        if (fsApi.existsSync(folderPath)) {
          return;
        }

        return fs.mkdir(folderPath, { recursive: true });
      }))))));
}

async function initializeRepositories() {
  const snapshotsRepository = RepositoryFactory.create(config.recorder.snapshots.storage);
  const sourceVersionsRepository = RepositoryFactory.create(config.recorder.versions.storage);
  const targetRepositoryConfig = config.util.cloneDeep(config.recorder.versions.storage);

  targetRepositoryConfig.git.path = path.join(ROOT_OUTPUT, 'resulting-versions');
  const targetVersionsRepository = RepositoryFactory.create(targetRepositoryConfig);

  await Promise.all([
    sourceVersionsRepository.initialize(),
    targetVersionsRepository.initialize().then(() => targetVersionsRepository.removeAll()),
    snapshotsRepository.initialize(),
  ]);

  await copyReadme(sourceVersionsRepository, targetVersionsRepository);

  return {
    versionsRepository: targetVersionsRepository,
    snapshotsRepository,
  };
}

async function copyReadme(sourceRepository, targetRepository) {
  const sourceRepositoryReadmePath = `${sourceRepository.path}/README.md`;
  const targetRepositoryReadmePath = `${targetRepository.path}/README.md`;

  const [firstReadmeCommit] = await sourceRepository.git.log(['README.md']);

  if (!firstReadmeCommit) {
    console.warn(`No commit found for README in ${sourceRepository.path}`);

    return;
  }

  await fs.copyFile(sourceRepositoryReadmePath, targetRepositoryReadmePath);
  await targetRepository.git.add(targetRepositoryReadmePath);
  await targetRepository.git.commit({
    filePath: targetRepositoryReadmePath,
    message: firstReadmeCommit.message,
    date: firstReadmeCommit.date,
  });
}

async function initializeSnapshotContentToSkip(snapshotsIds, repository) {
  return Promise.all(snapshotsIds.map(async snapshotsId => {
    const { content, mimeType } = await repository.findById(snapshotsId);

    return filter({ pageDeclaration: genericPageDeclaration, content, mimeType });
  }));
}

function info(...args) {
  console.log(colors.grey(...args));
}

function applyDocumentTypeRenaming(rules, snapshot) {
  snapshot.documentType = rules[snapshot.documentType] || snapshot.documentType;
}

async function handleSnapshot(snapshot, options, index) {
  const { serviceId, documentType } = snapshot;
  const { validUntil, pages: [pageDeclaration] } = servicesDeclarations[serviceId].getDocumentDeclaration(documentType, snapshot.fetchDate);

  info(`${index}`.padStart(5, ' '), serviceId, '-', documentType, '  ', 'Snapshot', snapshot.id, 'fetched at', snapshot.fetchDate.toISOString(), 'with declaration valid until', validUntil || 'now');

  const { shouldSkip, reason } = checkIfSnapshotShouldBeSkipped(snapshot, pageDeclaration);

  if (shouldSkip) {
    console.log(`    ↳ Skip: ${reason}`);
    fs.writeFile(path.join(SKIPPED_OUTPUT, serviceId, documentType, generateFileName(snapshot)), snapshot.content);

    return;
  }

  try {
    const version = await filter({
      pageDeclaration,
      content: snapshot.content,
      mimeType: snapshot.mimeType,
    });

    const record = new Record({
      content: version,
      serviceId,
      documentType,
      snapshotId: snapshot.id,
      fetchDate: snapshot.fetchDate,
      mimeType: 'text/markdown',
      snapshotIds: [snapshot.id],
    });

    const tmpFilePath = path.join(os.tmpdir(), 'regenerated-version.md');

    await fs.writeFile(tmpFilePath, version);
    const diffString = await versionsRepository.git.diff([ '--word-diff=color', `${serviceId}/${documentType}.md`, tmpFilePath ]).catch(async error => {
      if (!error.message.includes('Could not access')) {
        throw error;
      }

      const { id } = await versionsRepository.save(record);

      console.log(`    ↳ Generated first version: ${id}`);
    });

    if (!diffString) {
      return;
    }

    console.log(diffString);

    fs.writeFile(path.join(TO_CHECK_OUTPUT, serviceId, documentType, generateFileName(snapshot)), snapshot.content);

    if (options.interactive) {
      const { validVersion } = await inquirer.prompt([{ message: 'Is this version valid?', type: 'list', choices: [ 'Yes, keep it!', 'No, I updated the declaration, let\'s retry' ], name: 'validVersion' }]);

      if (validVersion == 'No, I updated the declaration, let\'s retry') {
        console.log('Reloading declarations…');
        servicesDeclarations = await services.loadWithHistory();

        return handleSnapshot(snapshot, options, index);
      }
    }

    const { id } = await versionsRepository.save(record);

    console.log(`    ↳ Generated new version: ${id}`);
  } catch (error) {
    if (!(error instanceof InaccessibleContentError)) {
      throw error;
    }

    const filteredSnapshotContent = await filter({ pageDeclaration: genericPageDeclaration, content: snapshot.content, mimeType: snapshot.mimeType });

    if (contentsToSkip.find(contentToSkip => contentToSkip == filteredSnapshotContent)) {
      console.log(`    ↳ Skip ${snapshot.id} as its content matches a content to skip`);

      return;
    }

    console.log('    ↳ An error occured while filtering:', error.message);

    const line = colors.grey(colors.underline(`${' '.repeat(process.stdout.columns)}`));

    console.log(`\n${line}\n${colors.cyan(filteredSnapshotContent)}\n${line}\n`);

    const { skip } = await inquirer.prompt([{ message: 'Should this snapshot be skipped?', type: 'list', name: 'skip', choices: [ 'Yes, skip it!', 'No, I updated the declaration, let\'s retry' ] }]);

    if (skip == 'Yes, skip it!') {
      contentsToSkip.push(filteredSnapshotContent);

      console.log('Do not forget to append "{snapshot.id}" in "snapshotsIdsWithContentToSkip" array');
    } else {
      console.log('Reloading declarations…');
      servicesDeclarations = await services.loadWithHistory();

      return handleSnapshot(snapshot, options, index);
    }
  }
}

function generateFileName(snapshot) {
  return `${snapshot.fetchDate.toISOString().replace(/\.\d{3}/, '').replace(/:|\./g, '-')}-${snapshot.id}.html`;
}

function checkIfSnapshotShouldBeSkipped(snapshot, pageDeclaration) {
  const { serviceId, documentType } = snapshot;

  const contentsToSkip = contentSkippingRules[serviceId] && contentSkippingRules[serviceId][documentType];
  const selectorsToSkip = selectorSkippingRules[serviceId] && selectorSkippingRules[serviceId][documentType];
  const missingRequiredSelectors = missingRequiredSelectorSkippingRules[serviceId] && missingRequiredSelectorSkippingRules[serviceId][documentType];

  if (!(contentsToSkip || selectorsToSkip || missingRequiredSelectors)) {
    return { shouldSkip: false };
  }

  const { window: { document: webPageDOM } } = new JSDOM(snapshot.content, { url: pageDeclaration.location, virtualConsole: new jsdom.VirtualConsole() });

  const selectorToSkip = selectorsToSkip && selectorsToSkip.find(selector => webPageDOM.querySelectorAll(selector).length);
  const missingRequiredSelector = missingRequiredSelectors && missingRequiredSelectors.find(selector => !webPageDOM.querySelectorAll(selector).length);
  const contentToSkip = contentsToSkip && Object.entries(contentsToSkip).find(([ key, value ]) => webPageDOM.querySelector(key)?.innerHTML == value);

  if (!(selectorToSkip || missingRequiredSelector || contentToSkip)) {
    return { shouldSkip: false };
  }

  let reason;

  if (selectorToSkip) {
    reason = `its content matches a selector to skip: "${selectorToSkip}"`;
  }

  if (missingRequiredSelector) {
    reason = `its content does not match a required selector: "${missingRequiredSelector}"`;
  }

  if (contentToSkip) {
    reason = `its content matches a content to skip: ${contentToSkip}`;
  }

  return {
    shouldSkip: true,
    reason,
  };
}

async function cleanupEmptyDirectories() {
  /* eslint-disable no-await-in-loop */
  return Promise.all([ TO_CHECK_OUTPUT, SKIPPED_OUTPUT ].map(async folder => {
    const servicesDirectories = (await fs.readdir(folder, { withFileTypes: true })).filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);

    for (const servicesDirectory of servicesDirectories) {
      const documentTypeDirectories = (await fs.readdir(path.join(folder, servicesDirectory), { withFileTypes: true })).filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);

      for (const documentTypeDirectory of documentTypeDirectories) {
        const files = await fs.readdir(path.join(folder, servicesDirectory, documentTypeDirectory));

        if (!files.length) {
          await fs.rmdir(path.join(folder, servicesDirectory, documentTypeDirectory));
        }
      }

      const cleanedDocumentTypeDirectories = (await fs.readdir(path.join(folder, servicesDirectory), { withFileTypes: true })).filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);

      if (!cleanedDocumentTypeDirectories.length) {
        await fs.rmdir(path.join(folder, servicesDirectory));
      }
    }
  }));
  /* eslint-enable no-await-in-loop */
}
