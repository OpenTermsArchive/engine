import path from 'path';
import { fileURLToPath } from 'url';

import config from 'config';

import Recorder from '../../src/archivist/recorder/index.js';
import Git from '../../src/storage-adapters/git/git.js';
import GitAdapter from '../../src/storage-adapters/git/index.js';
import * as renamer from '../utils/renamer/index.js';

import * as initializer from './initializer/index.js';
import { loadFile } from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_PATH = path.resolve(__dirname, '../../');

export const SNAPSHOTS_SOURCE_PATH = path.resolve(ROOT_PATH, config.get('rewrite.snapshotsSourcePath'));
export const SNAPSHOTS_TARGET_PATH = path.resolve(ROOT_PATH, config.get('recorder.snapshots.storage.git.path'));
export const VERSIONS_TARGET_PATH = path.resolve(ROOT_PATH, config.get('recorder.versions.storage.git.path'));

const initialize = process.argv.includes('--init');

const COUNTERS = {
  rewritten: 0,
  skippedNoChanges: 0,
};

let recorder;

(async () => {
  console.time('Total time');
  console.log('Start rewritting history.');

  await renamer.loadRules();
  const sourceRepo = new Git({ path: SNAPSHOTS_SOURCE_PATH, author: config.get('recorder.snapshots.storage.git.author') });

  await sourceRepo.initialize();

  console.log('Waiting for git log… (this can take a while)');
  const commits = (await sourceRepo.log(['--stat=4096'])).sort((a, b) => new Date(a.date) - new Date(b.date));

  console.log(`Source repo contains ${commits.length} commits.\n`);

  if (initialize) {
    const targetRepo = await initializer.initTargetRepo(SNAPSHOTS_TARGET_PATH);
    const [readmeCommit] = commits;

    await initializer.initReadmeAndLicense(targetRepo, SNAPSHOTS_TARGET_PATH, readmeCommit.date);
  }

  recorder = new Recorder({
    versionsStorageAdapter: new GitAdapter({
      ...config.get('recorder.versions.storage.git'),
      path: VERSIONS_TARGET_PATH,
    }),
    snapshotsStorageAdapter: new GitAdapter({
      ...config.get('recorder.snapshots.storage.git'),
      path: SNAPSHOTS_TARGET_PATH,
    }),
  });
  await recorder.initialize();

  const filteredCommits = commits.filter(({ message }) =>
    message.match(/^(Start tracking|Update)/));

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

    const { id: snapshotId } = await recorder.recordSnapshot({
      serviceId,
      documentType,
      content,
      mimeType,
      fetchDate: commit.date,
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
