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
  logger.info('options', options);
  const serviceId = options.serviceId || '*';
  const documentType = options.documentType || '*';
  const hasFilter = serviceId != '*' || documentType != '*';
  const hasDocumentType = serviceId != '*' && documentType != '*';

  const loadHistory = async () => services.loadWithHistory(serviceId != '*' ? [serviceId] : undefined);

  let servicesDeclarations = await loadHistory();

  await fileStructure.init(servicesDeclarations);

  const { versionsRepository, snapshotsRepository } = await fileStructure.initRepositories();

  const totalNbSnapshots = await snapshotsRepository.count();
  const nbSnapshotsToProcess = (await snapshotsRepository.findAll()).filter(s => s.serviceId == serviceId && s.documentType == documentType).length;

  logger.debug('Number of snapshot in the repository', logColors.info(totalNbSnapshots));
  if (hasFilter) {
    logger.debug('Number of snapshot for the specified service', logColors.info((nbSnapshotsToProcess)));
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

    logger.debug(colors.white(`${params.index}`.padStart(5, ' ')), '/', nbSnapshotsToProcess, colors.white(serviceId), '-', colors.white(documentType), '  ', 'Snapshot', snapshot.id, 'fetched at', snapshot.fetchDate.toISOString(), 'valid until', validUntil || 'now');

    const { shouldSkip, reason } = checkIfSnapshotShouldBeSkipped(snapshot, pageDeclaration);

    if (shouldSkip) {
      logger.debug(`    ↳ Skipped: ${reason}`);
      await fileStructure.writeSkippedSnapshot(serviceId, documentType, snapshot);

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
      });

      if (!diffString && params.index > 1) {
        logger.debug('    ↳ Skipped: version is identical to previous');

        return;
      }

      console.log(params.index === 1 ? colors.green(version) : diffString);
      logger.debug('Generated with the following command');
      logger.debug(`git diff ${diffArgs.map(arg => arg.replace(' ', '\\ ')).join(' ')}`);

      const toCheckSnapshotPath = await fileStructure.writeToCheckSnapshot(serviceId, documentType, snapshot);

      if (options.interactive) {
        const DECISION_VERSION_KEEP = 'Keep it';
        const DECISION_VERSION_SKIP_CONTENT = 'Skip: define content to be skipped';
        const DECISION_VERSION_SKIP_SELECTOR = 'Skip: define selector to be skipped';
        const DECISION_VERSION_SKIP_MISSING_SELECTOR = 'Skip: define selector that should not exist to be skipped';
        const DECISION_VERSION_SNAPSHOT = 'Show snapshot';
        const DECISION_VERSION_DECLARATION = 'Show current declaration used';
        const DECISION_VERSION_UPDATE = 'Add entry in history: I will fix the declaration';
        const DECISION_VERSION_RETRY = 'Retry: I updated the declaration';

        const { decision } = await inquirer.prompt([{
          message: 'A new version is available, is it valid?',
          type: 'list',
          pageSize: 20,
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
          const { skipContentSelector } = await inquirer.prompt({ type: 'input', name: 'skipContentSelector', message: 'CSS selector content will be selected from:' });
          const { skipContentValue } = await inquirer.prompt({ type: 'input', name: 'skipContentValue', message: 'innerHTML which, if exactly the same as the content of the selector above, will have the snapshot skipped:' });

          snapshotContentToSkip.push(version);
          cleaner.updateDocument(serviceId, documentType, 'skipContent', { [skipContentSelector]: skipContentValue });

          return handleSnapshot(snapshot, options, params);
        }
        if (decision == DECISION_VERSION_SKIP_SELECTOR) {
          const { skipSelector } = await inquirer.prompt({ type: 'input', name: 'skipSelector', message: 'CSS selector which, if present in the snasphot, will have it skipped:' });

          cleaner.updateDocument(serviceId, documentType, 'skipSelector', skipSelector);

          return handleSnapshot(snapshot, options, params);
        }

        if (decision == DECISION_VERSION_UPDATE) {
          await declarationUtils.updateHistory(serviceId, documentType, documentDeclaration, params);

          logger.warn('History has been updated, you now need to fix the current declaration');

          return handleSnapshot(snapshot, options, params);
        }

        if (decision == DECISION_VERSION_SKIP_MISSING_SELECTOR) {
          const { skipMissingSelector } = await inquirer.prompt({ type: 'input', name: 'skipMissingSelector', message: 'CSS selector which, if present in the snasphot, will have it skipped' });

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
        logger.debug('    ↳ Skipped: snapshot content is identical to one already skipped');

        return;
      }

      logger.error('    ↳ An error occured while filtering:', error.message);

      if (options.interactive) {
        const toCheckSnapshotPath = await fileStructure.writeToCheckSnapshot(serviceId, documentType, snapshot);

        const DECISION_ON_ERROR_BYPASS = 'Bypass: I don\'t know yet';
        const DECISION_ON_ERROR_SKIP = 'Skip: content of this snapshot is unprocessable';
        const DECISION_ON_ERROR_DECLARATION = 'Show current declaration used';
        const DECISION_ON_ERROR_SNAPSHOT = 'Show snapshot';
        const DECISION_ON_ERROR_UPDATE = 'Add entry in history: I will fix the declaration';
        const DECISION_ON_ERROR_RETRY = 'Retry: I updated the declaration';

        const { decisionOnError } = await inquirer.prompt([{
          message: 'A version can not be created from this snapshot. What do you want to do?',
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

  if (hasDocumentType) {
    const DECISION_END_DONE = 'All is ok, mark it as done';
    const DECISION_END_RETRY = 'Restart in non interactive mode';
    const DECISION_END_QUIT = 'Quit';

    const { decisionEnd } = await inquirer.prompt([{
      message: 'All snapshots have been analyzed. What do you want to do?',
      type: 'list',
      pageSize: 20,
      choices: [
        DECISION_END_DONE, DECISION_END_RETRY, DECISION_END_QUIT ],
      name: 'decisionEnd',
    }]);

    if (decisionEnd == DECISION_END_DONE) {
      cleaner.updateDocument(serviceId, documentType, 'done', true);
      logger.info(`${serviceId} - ${documentType} has been marked as done`);
      logger.warn("Don't forget to commit the changes");
      logger.info();
      logger.info(`git add declarations/${serviceId}*`);
      logger.info('git add cleaning/index.json');
      logger.info(`git commit -m "Clean ${serviceId} ${documentType}"`);
    }

    if (decisionEnd == DECISION_END_RETRY) {
      await main({ serviceId, documentType });
    }
    if (decisionEnd == DECISION_END_QUIT) {
      process.exit();
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
    pageSize: 20,
    choices,
    name: 'serviceToClean',
  }]);

  await main({ ...serviceToClean, interactive: true });
} else {
  await main(programOptions);
}
