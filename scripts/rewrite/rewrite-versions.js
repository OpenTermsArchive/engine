import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

import config from 'config';

import Git from '../../src/app/history/git.js';
import { loadFile } from './utils.js';
import * as renamer from './renamer/index.js';
import * as initier from './initializer/index.js';
import * as services from '../../src/app/services/index.js';
import filter from '../../src/app/filter/index.js';
import { InaccessibleContentError } from '../../src/app/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SNAPSHOTS_SOURCE_PATH = path.resolve(__dirname, '../../', config.get('rewrite.snapshotsSourcePath'));
export const VERSIONS_TARGET_PATH = path.resolve(__dirname, '../../', config.get('history.versionsPath'));

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

  if (process.argv.includes('--init')) {
    const targetRepo = await initier.initTargetRepo(VERSIONS_TARGET_PATH);
    const [ readmeCommit ] = commits;
    await initier.initReadmeAndLicense(targetRepo, VERSIONS_TARGET_PATH, readmeCommit.date);
  }

  history = await import(pathToFileURL(path.resolve(__dirname, '../..', 'src/app/history/index.js'))); // history module needs the target repo to be initiliazed. So loads it after target repo initialization.
  await history.init();

  const filteredCommits = commits.filter(({ message }) => (message.match(/^(Start tracking|Update)/)));

  const counters = {
    rewritten: 0,
    skippedNoChanges: 0,
    skippedInaccessibleContent: 0,
    skippedUnknownError: 0
  };

  /* eslint-disable no-await-in-loop */
  /* eslint-disable no-continue */
  for (const commit of filteredCommits) {
    console.log(Date.now(), commit.hash, commit.date, commit.message);

    await sourceRepo.checkout(commit.hash);

    const [{ file: relativeFilePath }] = commit.diff.files;

    const { content, mimeType } = await loadFile(SNAPSHOTS_SOURCE_PATH, relativeFilePath);

    let serviceId = path.dirname(relativeFilePath);
    let documentType = path.basename(relativeFilePath, path.extname(relativeFilePath));

    const { renamedServiceId, renamedDocumentType } = renamer.applyRules(serviceId, documentType);
    serviceId = renamedServiceId;
    documentType = renamedDocumentType;

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
        counters.rewritten++;
      } else {
        counters.skippedNoChanges++;
      }
    } catch (error) {
      if (error instanceof InaccessibleContentError) {
        console.log('⌙ Skip inacessible content');
        counters.skippedInaccessibleContent++;
      } else {
        console.log('⌙ Unknown error:', error);
        counters.skippedUnknownError++;
      }
    }
  }

  const totalTreatedCommits = Object.values(counters).reduce((acc, value) => acc + value, 0);
  console.log(`\nCommits treated: ${totalTreatedCommits} on ${filteredCommits.length}`);
  console.log(`⌙ Commits rewritten: ${counters.rewritten}`);
  console.log(`⌙ Skipped not changed commits: ${counters.skippedNoChanges}`);
  console.log(`⌙ Skipped inacessible content: ${counters.skippedInaccessibleContent}`);
  console.log(`⌙ Skipped unknown error: ${counters.skippedUnknownError}`);
  console.timeEnd('Total time');

  if (totalTreatedCommits != filteredCommits.length) {
    console.error('\n⚠ WARNING: Total treated commits does not match the total number of commits to be treated! ⚠');
  }

  if (counters.skippedUnknownError) {
    console.error('\n⚠ WARNING: Some unknown errors occured, check log! ⚠');
  }
})();
