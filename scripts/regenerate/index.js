import fs from 'fs/promises';
import os from 'node:os';
import path from 'path';
import { fileURLToPath } from 'url';

import { program } from 'commander';
import config from 'config';
import inquirer from 'inquirer';
import jsdom from 'jsdom';

import { InaccessibleContentError } from '../../src/archivist/errors.js';
import filter from '../../src/archivist/filter/exports.js';
import Record from '../../src/archivist/recorder/record.js';
import * as services from '../../src/archivist/services/index.js';

import Cleaner from './Cleaner.js';
import DeclarationUtils from './DeclarationUtils.js';
import FilesystemStructure from './FilesystemStructure.js';
import logger, { colors, logColors } from './logger.js';

const { JSDOM } = jsdom;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DECLARATIONS_PATH = config.services.declarationsPath;

const ROOT_OUTPUT = path.resolve(__dirname, 'output');
const CLEANING_FOLDER = path.join(DECLARATIONS_PATH, '../cleaning');

const INSTANCE_NAME = DECLARATIONS_PATH.split('/').reverse()[1].replace('-declarations', '');

const SNAPSHOTS_REPOSITORY_URL = `https://github.com/OpenTermsArchive/${INSTANCE_NAME}-snapshots`;
// const VERSIONS_REPOSITORY_URL = `https://github.com/OpenTermsArchive/${INSTANCE_NAME}-versions`;

const cleaner = new Cleaner(CLEANING_FOLDER);
const fileStructure = new FilesystemStructure(ROOT_OUTPUT, { snapshotRepoConfig: config.recorder.snapshots.storage, versionRepoConfig: config.recorder.versions.storage });
const declarationUtils = new DeclarationUtils(DECLARATIONS_PATH, { logger });

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
const programOptions = program.opts();

if (programOptions.interactive) {
  logger.info('Interactive mode enabled');
}

logger.info('programOptions', programOptions);

const main = async options => {
  const serviceId = options.serviceId || '*';
  const documentType = options.documentType || '*';
  const hasFilter = serviceId != '*' || documentType != '*';
  const hasDocumentType = serviceId != '*' && documentType != '*';

  const loadHistory = async () => services.loadWithHistory(serviceId != '*' ? [serviceId] : undefined);

  let servicesDeclarations = await loadHistory();

  await fileStructure.init(servicesDeclarations);

  const { versionsRepository, snapshotsRepository } = await fileStructure.initRepositories();

  logger.debug('Number of snapshot in the repository', logColors.info(await snapshotsRepository.count()));
  if (hasFilter) {
    logger.debug('Number of snapshot for the specified service', logColors.info((await snapshotsRepository.findAll()).filter(s => s.serviceId == serviceId && s.documentType == documentType).length));
  }

  if (hasDocumentType && cleaner.isDocumentDone(serviceId, documentType)) {
    logger.error(`${serviceId} - ${documentType} has already been marked as done. If you're sure of what you're doing, manually remove "done" from the cleaning file`);
    process.exit();
  }

  const snapshotContentToSkip = await initializeSnapshotContentToSkip(serviceId, documentType, snapshotsRepository);

  async function handleSnapshot(snapshot, options, params) {
    const { serviceId, documentType } = snapshot;
    const documentDeclaration = servicesDeclarations[serviceId].getDocumentDeclaration(documentType, snapshot.fetchDate);

    const { validUntil, pages: [pageDeclaration] } = documentDeclaration;

    logger.debug(`${params.index}`.padStart(5, ' '), serviceId, '-', documentType, '  ', 'Snapshot', snapshot.id, 'fetched at', snapshot.fetchDate.toISOString(), 'with declaration valid until', validUntil || 'now');

    const { shouldSkip, reason } = checkIfSnapshotShouldBeSkipped(snapshot, pageDeclaration);

    if (shouldSkip) {
      logger.debug(`    ↳ Skip: ${reason}`);
      fileStructure.writeSkippedSnapshot(serviceId, documentType, snapshot);

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

      const toCheckSnapshotPath = fileStructure.writeToCheckSnapshot(serviceId, documentType, snapshot);

      if (options.interactive) {
        const DECISION_VERSION_KEEP = 'Yes, keep it!';
        const DECISION_VERSION_SKIP_CONTENT = 'Skip this snapshot based on a content';
        const DECISION_VERSION_SKIP_SELECTOR = 'Skip this snapshot based on a selector';
        const DECISION_VERSION_SKIP_MISSING_SELECTOR = 'Skip this snapshot if selector does not exist';
        const DECISION_VERSION_SNAPSHOT = 'Not sure, show snapshot';
        const DECISION_VERSION_DECLARATION = 'Not sure, show current declaration used';
        const DECISION_VERSION_UPDATE = 'Add an entry in the history, I will fix the declaration';
        const DECISION_VERSION_RETRY = 'No, but I updated the declaration, let\'s retry';

        const { decision } = await inquirer.prompt([{
          message: 'Is this version valid?',
          type: 'list',
          choices: [
            new inquirer.Separator('Decide'), DECISION_VERSION_KEEP, DECISION_VERSION_RETRY, new inquirer.Separator('Analyze'), DECISION_VERSION_SNAPSHOT, DECISION_VERSION_DECLARATION, new inquirer.Separator('Update'), DECISION_VERSION_SKIP_CONTENT, DECISION_VERSION_SKIP_SELECTOR, DECISION_VERSION_SKIP_MISSING_SELECTOR, DECISION_VERSION_UPDATE ],
          name: 'decision',
        }]);

        if (decision == DECISION_VERSION_KEEP) {
          // Pass to next snapshot
        }

        if (decision == DECISION_VERSION_RETRY) {
          logger.debug('Reloading declarations…');
          servicesDeclarations = await loadHistory();

          return handleSnapshot(snapshot, options, params);
        }

        if (decision == DECISION_VERSION_SNAPSHOT) {
          logger.info('');
          logger.info('- Open it in your IDE');
          logger.info(`open -a "Google Chrome" "${toCheckSnapshotPath}"`);
          logger.info('');
          logger.info('- Or see it online');
          logger.info(`${SNAPSHOTS_REPOSITORY_URL}/commit/${snapshot.id}`);
          await inquirer.prompt({ type: 'confirm', name: 'Click on the link above to see the snapshot and then click to continue' });

          return handleSnapshot(snapshot, options, params);
        }

        if (decision == DECISION_VERSION_DECLARATION) {
          declarationUtils.logDeclaration(documentDeclaration);
          await inquirer.prompt({ type: 'confirm', name: 'Continue' });

          return handleSnapshot(snapshot, options, params);
        }

        if (decision == DECISION_VERSION_SKIP_CONTENT) {
          const { skipContentSelector } = await inquirer.prompt({ type: 'input', name: 'skipContentSelector', message: 'The selector you will test the content of' });
          const { skipContentValue } = await inquirer.prompt({ type: 'input', name: 'skipContentValue', message: 'The value which, if present, will make the snapshot skipped' });

          snapshotContentToSkip.push(version);
          cleaner.updateDocument(serviceId, documentType, 'skipContent', { [skipContentSelector]: skipContentValue });

          return handleSnapshot(snapshot, options, params);
        }
        if (decision == DECISION_VERSION_SKIP_SELECTOR) {
          const { skipSelector } = await inquirer.prompt({ type: 'input', name: 'skipSelector', message: 'The selector which, if present, will make the snapshot skipped' });

          cleaner.updateDocument(serviceId, documentType, 'skipSelector', skipSelector);

          return handleSnapshot(snapshot, options, params);
        }

        if (decision == DECISION_VERSION_UPDATE) {
          await declarationUtils.updateHistory(serviceId, documentType, documentDeclaration, params);

          logger.warn('History has been updated, you now need to fix the current declaration');

          return handleSnapshot(snapshot, options, params);
        }

        if (decision == DECISION_VERSION_SKIP_MISSING_SELECTOR) {
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

      const filteredSnapshotContent = await filter({ pageDeclaration: DeclarationUtils.genericPageDeclaration, content: snapshot.content, mimeType: snapshot.mimeType });

      if (snapshotContentToSkip.find(contentToSkip => contentToSkip == filteredSnapshotContent)) {
        logger.debug(`    ↳ Skip ${snapshot.id} as its content matches a content to skip`);

        return;
      }

      logger.error('    ↳ An error occured while filtering:', error.message);

      if (options.interactive) {
        const toCheckSnapshotPath = fileStructure.writeToCheckSnapshot(serviceId, documentType, snapshot);

        const DECISION_ON_ERROR_BYPASS = 'Take care of it later';
        const DECISION_ON_ERROR_SKIP = 'This snapshot is not useable, skip it!';
        const DECISION_ON_ERROR_DECLARATION = 'Not sure, show current declaration used';
        const DECISION_ON_ERROR_SNAPSHOT = 'Not sure, show snapshot';
        const DECISION_ON_ERROR_UPDATE = 'Add an entry in the history, I will fix the declaration';
        const DECISION_ON_ERROR_RETRY = 'Retry, I updated the declaration';

        const { decisionOnError } = await inquirer.prompt([{
          message: 'What do you want to do?',
          type: 'list',
          choices: [
            new inquirer.Separator('Decide'), DECISION_ON_ERROR_BYPASS, DECISION_ON_ERROR_SKIP, new inquirer.Separator('Analyze'), DECISION_ON_ERROR_DECLARATION, DECISION_ON_ERROR_SNAPSHOT, new inquirer.Separator('Update'), DECISION_ON_ERROR_UPDATE, DECISION_ON_ERROR_RETRY ],
          name: 'decisionOnError',
        }]);

        if (decisionOnError == DECISION_ON_ERROR_RETRY) {
          logger.debug('Reloading declarations…');
          servicesDeclarations = await loadHistory();

          return handleSnapshot(snapshot, options, params);
        }

        if (decisionOnError == DECISION_ON_ERROR_DECLARATION) {
          declarationUtils.logDeclaration(documentDeclaration);

          return handleSnapshot(snapshot, options, params);
        }

        if (decisionOnError == DECISION_ON_ERROR_UPDATE) {
          await declarationUtils.updateHistory(serviceId, documentType, documentDeclaration, params);

          logger.warn('History has been updated, you now need to fix the current declaration');

          return handleSnapshot(snapshot, options, params);
        }

        if (decisionOnError == DECISION_ON_ERROR_SNAPSHOT) {
          const line = colors.grey(colors.underline(`${' '.repeat(process.stdout.columns)}`));

          console.log(`\n\n${line}\n${colors.cyan(filteredSnapshotContent)}\n${line}\n\n`);
          logger.info('');
          logger.info('- Open it in your IDE');
          logger.info(`open -a "Google Chrome" "${toCheckSnapshotPath}"`);
          logger.info('');
          logger.info('- Or see it online');
          logger.info(`${SNAPSHOTS_REPOSITORY_URL}/commit/${snapshot.id}`);

          return handleSnapshot(snapshot, options, params);
        }

        if (decisionOnError == DECISION_ON_ERROR_SKIP) {
          snapshotContentToSkip.push(filteredSnapshotContent);
          cleaner.updateDocument(serviceId, documentType, 'skipCommit', snapshot.id);
        }

        if (decisionOnError == DECISION_ON_ERROR_BYPASS) {
          // Pass to next snapshot
        }
      }
    }
  }

  let index = 1;

  let previousValidUntil = null;

  console.time('Total execution time');
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
  console.timeEnd('Total execution time');

  if (hasDocumentType && options.interactive) {
    const DECISION_END_DONE = 'All is ok, mark it as done';
    const DECISION_END_RETRY = 'I want to relaunch it in non interactive mode to be sure';

    const { decisionEnd } = await inquirer.prompt([{
      message: 'What do you want to do?',
      type: 'list',
      choices: [
        DECISION_END_DONE, DECISION_END_RETRY ],
      name: 'decisionEnd',
    }]);

    if (decisionEnd == DECISION_END_DONE) {
      cleaner.updateDocument(serviceId, documentType, 'done', true);
      logger.info(`${serviceId} - ${documentType} has been marked as done`);
      logger.warn("Don't forget to commit the changes with the following message");
      logger.info(`git add declarations/${serviceId}.json`);
      logger.info('git add cleaning/index.json');
      logger.info(`git c -m "Clean ${serviceId} ${documentType}"`);
    }

    if (decisionEnd == DECISION_END_RETRY) {
      // Pass to next snapshot
      logger.warn('');
      logger.warn('Launch this command again without the -i to mark it as done');
    }
  }

  await fileStructure.finalize();
};

async function initializeSnapshotContentToSkip(serviceId, documentType, repository) {
  const snapshotsIds = cleaner.getSnapshotIdsToSkip(serviceId, documentType);

  return Promise.all(snapshotsIds.map(async snapshotsId => {
    const { content, mimeType } = await repository.findById(snapshotsId);

    return filter({ pageDeclaration: DeclarationUtils.genericPageDeclaration, content, mimeType });
  }));
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

if (programOptions.list) {
  const servicesDeclarations = await services.loadWithHistory();

  const choices = Object.entries(servicesDeclarations).map(([ serviceId, { documents }]) => Object.keys(documents).map(documentType => {
    const isDone = cleaner.isDocumentDone(serviceId, documentType);

    return { name: `${isDone ? '✅' : '❌'} ${serviceId} ${documentType}`, value: { serviceId, documentType } };
  })).flat();

  const { serviceToClean } = await inquirer.prompt([{
    message: 'Choose a document to clean',
    type: 'list',
    choices,
    name: 'serviceToClean',
  }]);

  await main({ ...serviceToClean, interactive: true });
} else {
  await main(programOptions);
}
