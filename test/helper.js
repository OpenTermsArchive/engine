import dotenv from 'dotenv';
dotenv.config();

import { git } from '../src/history/git.js';

let lastCommitId;
let stashResult;

before(async () => {
  const { latest: { hash } } = await git.log(['-1']);
  lastCommitId = hash;
  stashResult = await git.stash(['-u']);
});

after(async () => {
  await git.reset(['--hard', lastCommitId]);
  if (stashResult.includes('No local changes to save')) {
    return;
  }
  return git.stash(['pop']);
});
