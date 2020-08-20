import path from 'path';
import fsApi from 'fs';

import Git from '../src/app/history/git.js';
import { SNAPSHOTS_PATH, VERSIONS_PATH } from '../src/app/history/index.js';

const fs = fsApi.promises;
let _gitVersion;
let _gitSnapshot;

before(initRepo);
after(eraseRepo);

export async function resetGitRepository() {
  await eraseRepo();
  return initRepo();
}

async function initRepo() {
  _gitVersion = new Git(VERSIONS_PATH);
  _gitSnapshot = new Git(SNAPSHOTS_PATH);
  return Promise.all([ _gitVersion.init(), _gitSnapshot.init() ]);
}

export function gitVersion() {
  return _gitVersion;
}

export function gitSnapshot() {
  return _gitSnapshot;
}

async function eraseRepo() {
  const promises = [];

  for (const repoPath of [ VERSIONS_PATH, SNAPSHOTS_PATH ]) {
    const files = await fs.readdir(repoPath, { withFileTypes: true }); // eslint-disable-line no-await-in-loop

    promises.push(...files.map(file => {
      const filePath = path.join(repoPath, file.name);

      if (file.isDirectory()) {
        return fs.rmdir(filePath, { recursive: true });
      }

      if (file.name !== 'README.md') {
        return fs.unlink(filePath);
      }

      return Promise.resolve();
    }));
  }

  return Promise.all(promises);
}
