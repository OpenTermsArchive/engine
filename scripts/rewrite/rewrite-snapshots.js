import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

import config from 'config';

import Git from '../../src/app/history/git.js';
import { loadFile } from './utils.js';
import * as renamer from './renamer/index.js';
import * as initializer from './initializer/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SNAPSHOTS_SOURCE_PATH = path.resolve(__dirname, '../../', config.get('rewrite.snapshotsSourcePath'));
export const SNAPSHOTS_TARGET_PATH = path.resolve(__dirname, '../../', config.get('history.snapshotsPath'));

const initialize = process.argv.includes('--init');

const COUNTERS = {
  rewritten: 0,
  skippedNoChanges: 0
};

let history;
(async () => {
  console.time('Total time');
  console.log('Start rewritting history.');

  await renamer.loadRules();
  const sourceRepo = new Git(SNAPSHOTS_SOURCE_PATH);

  console.log('Waiting for git log… (this can take a while)');
  const commits = (await sourceRepo.log([ '--stat=4096' ])).sort((a, b) => new Date(a.date) - new Date(b.date));
  console.log(`Source repo contains ${commits.length} commits.\n`);

  if (initialize) {
    const targetRepo = await initializer.initTargetRepo(SNAPSHOTS_TARGET_PATH);
    const [ readmeCommit ] = commits;
    await initializer.initReadmeAndLicense(targetRepo, SNAPSHOTS_TARGET_PATH, readmeCommit.date);
  }

  history = await import(pathToFileURL(path.resolve(__dirname, '../..', 'src/app/history/index.js'))); // history module needs the target repo to be initiliazed. So loads it after target repo initialization.
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

    const { id: snapshotId } = await history.recordSnapshot({
      serviceId,
      documentType,
      content,
      mimeType,
      authorDate: commit.date,
      extraChangelogContent: commit.body,
    });

    if (snapshotId) {
      COUNTERS.rewritten++;
    } else {
      COUNTERS.skippedNoChanges++;
    }
  }

  const totalTreatedCommits = Object.values(COUNTERS).reduce((acc, value) => acc + value, 0);
  console.log(`\nCommits treated: ${totalTreatedCommits} on ${filteredCommits.length}`);
  console.log(`⌙ Commits rewritten: ${COUNTERS.rewritten}`);
  console.log(`⌙ Skipped not changed commits: ${COUNTERS.skippedNoChanges}`);
  console.timeEnd('Total time');

  if (totalTreatedCommits != filteredCommits.length) {
    console.error('\n⚠ WARNING: Total treated commits does not match the total number of commits to be treated! ⚠');
  }
})();
