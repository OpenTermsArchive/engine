import fsApi from 'fs';
import fs from 'fs/promises';
import os from 'node:os';
import path from 'path';
import { fileURLToPath } from 'url';

import { program } from 'commander';
import config from 'config';
import DeepDiff from 'deep-diff';
import inquirer from 'inquirer';
import jsdom from 'jsdom';

import { InaccessibleContentError } from '../../src/archivist/errors.js';
import filter from '../../src/archivist/filter/exports.js';
import Record from '../../src/archivist/recorder/record.js';
import RepositoryFactory from '../../src/archivist/recorder/repositories/factory.js';
import * as services from '../../src/archivist/services/index.js';

import Cleaner from './Cleaner.js';
import logger, { colors } from './logger.js';

const { JSDOM } = jsdom;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DECLARATIONS_PATH = config.services.declarationsPath;

const ROOT_OUTPUT = path.resolve(__dirname, 'output');
const SKIPPED_OUTPUT = path.join(ROOT_OUTPUT, 'skipped');
const TO_CHECK_OUTPUT = path.join(ROOT_OUTPUT, 'to-check');
const CLEANING_FOLDER = path.join(DECLARATIONS_PATH, '../cleaning');

const INSTANCE_NAME = DECLARATIONS_PATH.split('/').reverse()[1].replace('-declarations', '');

const SNAPSHOTS_REPOSITORY_URL = `https://github.com/OpenTermsArchive/${INSTANCE_NAME}-snapshots`;
const VERSIONS_REPOSITORY_URL = `https://github.com/OpenTermsArchive/${INSTANCE_NAME}-versions`;

const cleaner = new Cleaner(CLEANING_FOLDER);

const updateHistory = async (serviceId, documentType, documentDeclaration, { previousValidUntil }) => {
  const historyFullPath = `${DECLARATIONS_PATH}/${serviceId}.history.json`;

  if (!fsApi.existsSync(historyFullPath)) {
    fsApi.writeFileSync(historyFullPath, `${JSON.stringify({ [documentType]: [] }, null, 2)}\n`);
  }

  const currentJSONDeclaration = { ...declarationToJSON(documentDeclaration).documents[documentType] };

  const existingHistory = JSON.parse(fsApi.readFileSync(historyFullPath).toString());

  const historyEntries = existingHistory[documentType] || [];

  let entryAlreadyExists = false;

  existingHistory[documentType] = [...existingHistory[documentType] || []];

  historyEntries.map(({ validUntil, ...historyEntry }) => {
    const diff = DeepDiff.diff(historyEntry, currentJSONDeclaration);

    if (!diff) {
      return { ...historyEntry, validUntil };
    }

    entryAlreadyExists = true;
    logger.info(`History entry is already present, updating validUntil to ${previousValidUntil}`);

    return { ...historyEntry, validUntil: previousValidUntil };
  });

  if (!entryAlreadyExists) {
    logger.info('History entry does not exist, creating one');
    existingHistory[documentType] = [ ...existingHistory[documentType], { ...currentJSONDeclaration, validUntil: previousValidUntil }];
  }

  fsApi.writeFileSync(historyFullPath, `${JSON.stringify(existingHistory, null, 2)}\n`);
};

program
  .name('regenerate')
  .description('Cleanup services declarations and regenerate versions history')
  .version('0.0.1');

program
  .option('-l, --list', 'lists all services to be handled')
  .option('-s, --serviceId [serviceId]', 'service ID of service to handle')
  .option('-d, --documentType [documentType]', 'document type to handle')
  .option('-i, --interactive', 'Enable interactive mode to validate each version and choose if snapshot should be skipped');

program.parse(process.argv);
const options = program.opts();

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

const pageToJSON = page => ({
  fetch: page.location,
  select: page.contentSelectors,
  remove: page.noiseSelectors,
  filter: page.filters ? page.filters.map(filter => filter.name) : undefined,
  executeClientScripts: page.executeClientScripts,
});

const declarationToJSON = declaration => ({
  name: declaration.service.name,
  documents: {
    [declaration.type]: declaration.isMultiPage
      ? { combine: declaration.pages.map(page => pageToJSON(page)) }
      : pageToJSON(declaration.pages[0]),
  },
});

const main = async () => {
  let servicesDeclarations = await services.loadWithHistory();

  if (options.list) {
    Object.entries(servicesDeclarations).forEach(([ listServiceId, { documents }]) => Object.keys(documents).forEach(listDocumentType => {
      const isDone = cleaner.isDocumentDone(listServiceId, listDocumentType);

      console.log(isDone ? '✅' : '❌', `-s ${listServiceId} -d "${listDocumentType}" -i`);
    }));
    process.exit();
  }

  await initializeDirectories(servicesDeclarations);

  const { versionsRepository, snapshotsRepository } = await initializeRepositories();

  async function handleSnapshot(snapshot, options, params) {
    const { serviceId, documentType } = snapshot;
    const documentDeclaration = servicesDeclarations[serviceId].getDocumentDeclaration(documentType, snapshot.fetchDate);

    const { validUntil, pages: [pageDeclaration] } = documentDeclaration;

    logger.debug(`${params.index}`.padStart(5, ' '), serviceId, '-', documentType, '  ', 'Snapshot', snapshot.id, 'fetched at', snapshot.fetchDate.toISOString(), 'with declaration valid until', validUntil || 'now');

    const { shouldSkip, reason } = checkIfSnapshotShouldBeSkipped(snapshot, pageDeclaration);

    if (shouldSkip) {
      logger.debug(`    ↳ Skip: ${reason}`);
      fs.writeFile(path.join(SKIPPED_OUTPUT, serviceId, documentType, generateFileName(snapshot)), snapshot.content);

      return;
    }

    const snapshotFolder = path.join(TO_CHECK_OUTPUT, serviceId, documentType);
    const snapshotFilename = generateFileName(snapshot);
    const snapshotPath = path.join(snapshotFolder, snapshotFilename);

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

      const diffArgs = [ '--minimal', '--color=always', '--color-moved=zebra', `${serviceId}/${documentType}.md`, tmpFilePath ];

      const diffString = await versionsRepository.git.diff(diffArgs).catch(async error => {
        if (!error.message.includes('Could not access')) {
          throw error;
        }

        const { id } = await versionsRepository.save(record);

        logger.info(`    ↳ Generated first version: ${id}`);
      });

      if (!diffString) {
        return;
      }

      console.log(diffString);
      logger.debug('Generated with the following command');
      logger.debug(`git diff ${diffArgs.map(arg => arg.replace(' ', '\\ ')).join(' ')}`);

      fs.writeFile(snapshotPath, snapshot.content);

      if (options.interactive) {
        const DECISION_KEEP = 'Yes, keep it!';
        const DECISION_SKIP_CONTENT = 'Skip this snapshot based on a content';
        const DECISION_SKIP_SELECTOR = 'Skip this snapshot based on a selector';
        const DECISION_SKIP_MISSING_SELECTOR = 'Skip this snapshot if selector does not exist';
        const DECISION_SNAPSHOT = 'Not sure, show me the snapshot';
        const DECISION_DECLARATION = 'Not sure, show me the current declaration used';
        const DECISION_RETRY = 'No, but I updated the declaration, let\'s retry';

        const { decision } = await inquirer.prompt([{
          message: 'Is this version valid?',
          type: 'list',
          choices: [
            DECISION_KEEP, new inquirer.Separator('Analyze'), DECISION_SNAPSHOT, DECISION_DECLARATION, new inquirer.Separator('Update'), DECISION_SKIP_CONTENT, DECISION_SKIP_SELECTOR, DECISION_SKIP_MISSING_SELECTOR, DECISION_RETRY ],
          name: 'decision',
        }]);

        if (decision == DECISION_RETRY) {
          logger.debug('Reloading declarations…');
          servicesDeclarations = await services.loadWithHistory();

          return handleSnapshot(snapshot, options, params);
        }

        if (decision == DECISION_SNAPSHOT) {
          logger.info('');
          logger.info('- Open it in your IDE');
          logger.info(`open -a "Google Chrome" "${snapshotPath}"`);
          logger.info('');
          logger.info('- Or see it online');
          logger.info(`${SNAPSHOTS_REPOSITORY_URL}/commit/${snapshot.id}`);
          await inquirer.prompt({ type: 'confirm', name: 'Click on the link above to see the snapshot and then click to continue' });

          return handleSnapshot(snapshot, options, params);
        }

        if (decision == DECISION_DECLARATION) {
          logger.info(JSON.stringify(declarationToJSON(documentDeclaration), null, 2));
          await inquirer.prompt({ type: 'confirm', name: 'Continue' });

          return handleSnapshot(snapshot, options, params);
        }

        if (decision == DECISION_SKIP_CONTENT) {
          const { skipContentSelector } = await inquirer.prompt({ type: 'input', name: 'skipContentSelector', message: 'The selector you will test the content of' });
          const { skipContentValue } = await inquirer.prompt({ type: 'input', name: 'skipContentValue', message: 'The value which, if present, will make the snapshot skipped' });

          cleaner.updateDocument(serviceId, documentType, 'skipContent', { [skipContentSelector]: skipContentValue });

          return handleSnapshot(snapshot, options, params);
        }
        if (decision == DECISION_SKIP_SELECTOR) {
          const { skipSelector } = await inquirer.prompt({ type: 'input', name: 'skipSelector', message: 'The selector which, if present, will make the snapshot skipped' });

          cleaner.updateDocument(serviceId, documentType, 'skipSelector', skipSelector);

          return handleSnapshot(snapshot, options, params);
        }

        if (decision == DECISION_SKIP_MISSING_SELECTOR) {
          const { skipMissingSelector } = await inquirer.prompt({ type: 'input', name: 'skipMissingSelector', message: 'The selector which, if present, will make the snapshot skipped' });

          cleaner.updateDocument(serviceId, documentType, 'skipMissingSelector', skipMissingSelector);

          return handleSnapshot(snapshot, options, params);
        }
      }

      const { id } = await versionsRepository.save(record);

      logger.info(`    ↳ Generated new version: ${id}`);
    } catch (error) {
      if (!(error instanceof InaccessibleContentError)) {
        throw error;
      }

      const filteredSnapshotContent = await filter({ pageDeclaration: genericPageDeclaration, content: snapshot.content, mimeType: snapshot.mimeType });

      if (contentsToSkip.find(contentToSkip => contentToSkip == filteredSnapshotContent)) {
        logger.debug(`    ↳ Skip ${snapshot.id} as its content matches a content to skip`);

        return;
      }

      logger.error('    ↳ An error occured while filtering:', error.message);

      if (options.interactive) {
        fs.writeFile(snapshotPath, snapshot.content);

        const DECISION2_BYPASS = 'Take care of it later';
        const DECISION2_SKIP = 'This snapshot is not useable, skip it!';
        const DECISION2_SNAPSHOT = 'Not sure, show me the snapshot';
        const DECISION2_DECLARATION = 'Not sure, show me the current declaration used';
        const DECISION2_SNAPSHOT_CONTENT = 'Not sure, show me the snapshot content';
        const DECISION2_RETRY = 'Retry, I updated the declaration';
        const DECISION2_UPDATE = 'Update the declaration';

        const { decision2 } = await inquirer.prompt([{
          message: 'What do you want to do?',
          type: 'list',
          choices: [
            DECISION2_BYPASS, DECISION2_SKIP, DECISION2_SNAPSHOT, DECISION2_SNAPSHOT_CONTENT, DECISION2_DECLARATION, DECISION2_UPDATE, DECISION2_RETRY ],
          name: 'decision2',
        }]);

        if (decision2 == DECISION2_RETRY) {
          logger.debug('Reloading declarations…');
          servicesDeclarations = await services.loadWithHistory();

          return handleSnapshot(snapshot, options, params);
        }

        if (decision2 == DECISION2_DECLARATION) {
          logger.info(JSON.stringify(declarationToJSON(documentDeclaration), null, 2));
          await inquirer.prompt({ type: 'confirm', name: 'Continue' });

          return handleSnapshot(snapshot, options, params);
        }

        if (decision2 == DECISION2_SNAPSHOT_CONTENT) {
          const line = colors.grey(colors.underline(`${' '.repeat(process.stdout.columns)}`));

          console.log(`\n\n${line}\n${colors.cyan(filteredSnapshotContent)}\n${line}\n\n`);
          await inquirer.prompt({ type: 'confirm', name: 'Continue' });

          return handleSnapshot(snapshot, options, params);
        }

        if (decision2 == DECISION2_UPDATE) {
          await updateHistory(serviceId, documentType, documentDeclaration, params);

          logger.warn('History has been updated, you now need to fix the current declaration');

          return handleSnapshot(snapshot, options, params);
        }

        if (decision2 == DECISION2_SNAPSHOT) {
          logger.info('- Open it in your IDE');
          logger.info(`open -a "Google Chrome" "${snapshotPath}"`);
          logger.info('- Or see it online');
          logger.info(`${SNAPSHOTS_REPOSITORY_URL}/commit/${snapshot.id}`);
          await inquirer.prompt({ type: 'confirm', name: 'Click on the link above to see the snapshot and then click to continue' });

          return handleSnapshot(snapshot, options, params);
        }

        if (decision2 == DECISION2_SKIP) {
          logger.info(JSON.stringify(declarationToJSON(documentDeclaration), null, 2));
          cleaner.updateDocument(serviceId, documentType, 'skipCommit', snapshot.id);
        }

        if (decision2 == DECISION2_BYPASS) {
          // Pass to next snapshot
        }
      }
    }
  }

  logger.debug('Number of snapshot in the repository', colors.info(await snapshotsRepository.count()));

  const serviceId = options.serviceId || '*';
  const documentType = options.documentType || '*';

  if (serviceId != '*' || documentType != '*') {
    logger.debug('Number of snapshot for the specified service', colors.info((await snapshotsRepository.findAll()).filter(s => s.serviceId == serviceId && s.documentType == documentType).length));
  }
  if (serviceId != '*' && documentType != '*') {
    if (cleaner.isDocumentDone(serviceId, documentType)) {
      logger.error(`${serviceId} - ${documentType} has already been marked as done. If you're sure of what you're doing, manually remove "done" from the cleaning file`);
      process.exit();
    }
  }

  if (options.interactive) {
    logger.info('Interactive mode enabled');
  }

  logger.info('options', options);

  const contentsToSkip = await initializeSnapshotContentToSkip(serviceId, documentType, snapshotsRepository);

  let index = 1;

  let previousValidUntil = null;

  console.time('Total time');
  for await (const snapshot of snapshotsRepository.iterate([`${serviceId}/${documentType}.*`])) {
    if (!previousValidUntil) {
      previousValidUntil = snapshot.fetchDate.toISOString();
    }
    // Modifies snapshot in place
    snapshot.documentType = cleaner.getDocumentTypesRules()[snapshot.documentType] || snapshot.documentType;

    await handleSnapshot(snapshot, options, { index, previousValidUntil });
    index++;
    previousValidUntil = snapshot.fetchDate.toISOString();
  }
  console.timeEnd('Total time');

  if (serviceId != '*' || documentType != '*') {
    if (options.interactive) {
      const DECISION3_DONE = 'All is ok, mark it as done';
      const DECISION3_RETRY = 'I want to relaunch it in non interactive mode to be sure';

      const { decision3 } = await inquirer.prompt([{
        message: 'What do you want to do?',
        type: 'list',
        choices: [
          DECISION3_DONE, DECISION3_RETRY ],
        name: 'decision3',
      }]);

      if (decision3 == DECISION3_DONE) {
        cleaner.updateDocument(serviceId, documentType, 'done', true);
        logger.info(`${serviceId} - ${documentType} has been marked as done`);
        logger.warn("Don't forget to commit the changes with the following message");
        logger.info(`git add declarations/${serviceId}.json`);
        logger.info('git add cleaning/index.json');
        logger.info(`git c -m "Clean ${serviceId} ${documentType}"`);
      }

      if (decision3 == DECISION3_RETRY) {
        // Pass to next snapshot
        logger.warn('');
        logger.warn('Launch this command again without the -i to mark it as done');
      }
    }
  }

  await cleanupEmptyDirectories();
};

async function initializeDirectories(servicesDeclarations) {
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

async function initializeSnapshotContentToSkip(serviceId, documentType, repository) {
  const snapshotsIds = cleaner.getSnapshotIdsToSkip(serviceId, documentType);

  return Promise.all(snapshotsIds.map(async snapshotsId => {
    const { content, mimeType } = await repository.findById(snapshotsId);

    return filter({ pageDeclaration: genericPageDeclaration, content, mimeType });
  }));
}

function generateFileName(snapshot) {
  return `${snapshot.fetchDate.toISOString().replace(/\.\d{3}/, '').replace(/:|\./g, '-')}-${snapshot.id}.html`;
}

function checkIfSnapshotShouldBeSkipped(snapshot, pageDeclaration) {
  const { serviceId, documentType } = snapshot;

  const { contentsToSkip, selectorsToSkip, missingRequiredSelectors } = cleaner.getDocumentRules(serviceId, documentType);

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

main();
