import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

import config from 'config';

import Git from '../../src/app/history/git.js';
import { loadFile } from './utils.js';
import * as renamer from './renamer/index.js';
import * as initier from './initializer/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SNAPSHOTS_SOURCE_PATH = path.resolve(__dirname, '../../', config.get('rewrite.snapshotsSourcePath'));
export const SNAPSHOTS_TARGET_PATH = path.resolve(__dirname, '../../', config.get('history.snapshotsPath'));

const EMPTY_TOS_BACK_CONTENT = `<!DOCTYPE html><html><head></head><body>

</body></html>`;

let history;
(async function () {
  console.time('Total time');
  console.log('Start rewritting history.');
  const init = process.argv.includes('--init');

  const renamingRules = await renamer.loadRules();

  const sourceRepo = new Git(SNAPSHOTS_SOURCE_PATH);

  console.log('Waiting for git log… (this can take a while)');
  const commits = (await sourceRepo.log([ '--stat=4096' ])).sort((a, b) => new Date(a.date) - new Date(b.date));

  if (init) {
    const targetRepo = await initier.initTargetRepo(SNAPSHOTS_TARGET_PATH);

    const [ readmeCommit ] = commits;
    await initier.initReadmeAndLicense(targetRepo, SNAPSHOTS_TARGET_PATH, readmeCommit.date);
  }

  history = await import(pathToFileURL(path.resolve(__dirname, '../..', 'src/app/history/index.js'))); // history module needs the target repo to be initiliazed. So loads it after target repo initialization.

  const filteredCommits = commits.filter(({ message }) => (message.match(/^(Start tracking|Update)/)));

  console.log(`Source repo contains ${commits.length} commits.\n`);

  const alreadyTrackedByCGus = {};

  const counters = {
    rewritten: 0,
    skippedNoChanges: 0,
    skippedEmptyContent: 0,
    skippedEmptyCommit: 0,
    skippedAlreadyTrackedByCGUs: 0,
  };

  /* eslint-disable no-await-in-loop */
  /* eslint-disable no-continue */
  for (const commit of filteredCommits) {
    console.log(Date.now(), commit.hash, commit.date, commit.message);

    await sourceRepo.checkout(commit.hash);

    if (!commit.diff) {
      console.log('⌙ Skip empty commit');
      counters.skippedEmptyCommit++;
      continue;
    }

    const [{ file: relativeFilePath }] = commit.diff.files;

    const { content, mimeType } = await loadFile(SNAPSHOTS_SOURCE_PATH, relativeFilePath);

    let serviceId = path.dirname(relativeFilePath);
    let documentType = path.basename(relativeFilePath, path.extname(relativeFilePath));

    if (!content || content == EMPTY_TOS_BACK_CONTENT) {
      console.log(`⌙ Skip empty document "${documentType}" of "${serviceId}" service`);
      counters.skippedEmptyContent++;
      continue;
    }

    const { renamedServiceId, renamedDocumentType } = renamer.applyRules(serviceId, documentType, renamingRules);
    serviceId = renamedServiceId;
    documentType = renamedDocumentType;

    if (commit.body.includes('Imported from')) { // The commit is from ToSBack import
      if (serviceId == 'ASKfm') { // ToSBack wrongly called Ask.com to ASKfm
        serviceId = 'Ask.com';
        console.log(`⌙ Rename ToSBack "ASKfm" to "${serviceId}" service`);
      }

      if (documentType == 'unknown') {
        const [ filePath ] = commit.body.match(/\/tosdr\/tosback2\/[^\s]+/g); // Retrieve the document type from message body
        documentType = decodeURI(path.basename(filePath, path.extname(filePath)));
        console.log(`⌙ Rename "unknown" to "${documentType}" of "${serviceId}" service`);
      }

      if (alreadyTrackedByCGus[serviceId] && alreadyTrackedByCGus[serviceId][documentType]) { // When documents are tracked in parallel by ToSBack and CGUs, keep only the CGUs' one.
        console.log(`⌙ Skip already tracked by CGUs ToSBack document "${documentType}" of "${serviceId}" service`);
        counters.skippedAlreadyTrackedByCGUs++;
        continue;
      }
    } else {
      alreadyTrackedByCGus[serviceId] = alreadyTrackedByCGus[serviceId] || {};
      alreadyTrackedByCGus[serviceId][documentType] = true;
    }

    const { id: snapshotId } = await history.recordSnapshot({
      serviceId,
      documentType,
      content,
      mimeType,
      authorDate: commit.date,
      extraChangelogContent: commit.body,
    });

    if (snapshotId) {
      counters.rewritten++;
    } else {
      counters.skippedNoChanges++;
    }
  }

  const totalTreatedCommits = Object.values(counters).reduce((acc, value) => acc + value, 0);
  console.log(`\nCommits treated: ${totalTreatedCommits} on ${filteredCommits.length}`);
  console.log(`⌙ Commits rewritten: ${counters.rewritten}`);
  console.log(`⌙ Skipped not changed commits: ${counters.skippedNoChanges}`);
  console.log(`⌙ Skipped ToSBack commits already tracked by CGUs: ${counters.skippedAlreadyTrackedByCGUs}`);
  console.log(`⌙ Skipped empty content commits: ${counters.skippedEmptyContent}`);
  console.log(`⌙ Skipped empty commits: ${counters.skippedEmptyCommit}\n`);
  console.timeEnd('Total time');

  if (totalTreatedCommits != filteredCommits.length) {
    console.error('\n⚠ WARNING: Total treated commits does not match the total number of commits to be treated! ⚠');
  }
}());
