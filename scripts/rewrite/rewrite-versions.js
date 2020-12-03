import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

import config from 'config';

import Git from '../../src/app/history/git.js';
import { loadFile } from './utils.js';
import * as renamer from './renamer/index.js';
import * as initializer from './initializer/index.js';
import * as services from '../../src/app/services/index.js';
import filter from '../../src/app/filter/index.js';
import { InaccessibleContentError } from '../../src/app/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_PATH = path.resolve(__dirname, '../../');
export const SNAPSHOTS_SOURCE_PATH = path.resolve(ROOT_PATH, config.get('rewrite.snapshotsSourcePath'));
export const VERSIONS_TARGET_PATH = path.resolve(ROOT_PATH, config.get('history.versionsPath'));

const initialize = process.argv.includes('--init');

const COUNTERS = {
  rewritten: 0,
  skippedNoChanges: 0,
  skippedInaccessibleContent: 0,
  skippedUnknownError: 0
};

let history;
(async () => {
  console.time('Total time');
  console.log('Start rewritting history.');

  await renamer.loadRules();
  const servicesDeclarations = await services.loadWithHistory();
  const sourceRepo = new Git(SNAPSHOTS_SOURCE_PATH);

  console.log('Waiting for git log… (this can take a while)');
  const commits = (await sourceRepo.log([ '--stat=4096' ])).sort((a, b) => new Date(a.date) - new Date(b.date));
  console.log(`Source repo contains ${commits.length} commits.\n`);

  if (initialize) {
    const targetRepo = await initializer.initTargetRepo(VERSIONS_TARGET_PATH);
    const [ readmeCommit ] = commits;
    await initializer.initReadmeAndLicense(targetRepo, VERSIONS_TARGET_PATH, readmeCommit.date);
  }

  history = await import(pathToFileURL(path.resolve(ROOT_PATH, 'src/app/history/index.js'))); // history module needs the target repo to be initiliazed. So loads it after target repo initialization.
  await history.init();

  const filteredCommits = commits.filter(({ message }) => (message.match(/^(Start tracking|Update)/)));

  /* eslint-disable no-await-in-loop */
  /* eslint-disable no-continue */
  for (const commit of filteredCommits) {
    console.log(Date.now(), commit.hash, commit.date, commit.message);

    await sourceRepo.checkout(commit.hash);

    const [{ file: relativeFilePath }] = commit.diff.files;

    const { content, mimeType } = await loadFile(SNAPSHOTS_SOURCE_PATH, relativeFilePath);

    let serviceId = path.dirname(relativeFilePath);
    let documentType = path.basename(relativeFilePath, path.extname(relativeFilePath));

    ({ serviceId, documentType } = renamer.applyRules(serviceId, documentType));

    if (!servicesDeclarations[serviceId]) {
      console.log(`⌙ Skip unknown service "${serviceId}"`);
      continue;
    }

    const documentDeclaration = servicesDeclarations[serviceId].getDocumentDeclaration(documentType, commit.date);


    if (!documentDeclaration) {
      console.log(`⌙ Skip unknown document type "${documentType}" for service "${serviceId}"`);
      continue;
    }

    if (documentDeclaration.validUntil) {
      console.log(`⌙ Use declaration valid until ${documentDeclaration.validUntil}`);
    }

    try {
      const document = await filter({
        content,
        mimeType,
        documentDeclaration,
      });

      const { id: versionId } = await history.recordVersion({
        serviceId,
        documentType,
        content: document,
        authorDate: commit.date,
        snapshotId: commit.hash,
      });

      if (versionId) {
        COUNTERS.rewritten++;
      } else {
        COUNTERS.skippedNoChanges++;
      }
    } catch (error) {
      if (error instanceof InaccessibleContentError) {
        console.log('⌙ Skip inacessible content');
        COUNTERS.skippedInaccessibleContent++;
      } else {
        console.log('⌙ Unknown error:', error);
        COUNTERS.skippedUnknownError++;
      }
    }
  }

  const totalTreatedCommits = Object.values(COUNTERS).reduce((acc, value) => acc + value, 0);
  console.log(`\nCommits treated: ${totalTreatedCommits} on ${filteredCommits.length}`);
  console.log(`⌙ Commits rewritten: ${COUNTERS.rewritten}`);
  console.log(`⌙ Skipped not changed commits: ${COUNTERS.skippedNoChanges}`);
  console.log(`⌙ Skipped inacessible content: ${COUNTERS.skippedInaccessibleContent}`);
  console.log(`⌙ Skipped unknown error: ${COUNTERS.skippedUnknownError}`);
  console.timeEnd('Total time');

  if (totalTreatedCommits != filteredCommits.length) {
    console.error('\n⚠ WARNING: Total treated commits does not match the total number of commits to be treated! ⚠');
  }

  if (COUNTERS.skippedUnknownError) {
    console.error('\n⚠ WARNING: Some unknown errors occured, check log! ⚠');
  }
})();
