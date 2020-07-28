import path from 'path';
import fsApi from 'fs';
const fs = fsApi.promises;

import config from 'config';

import Git from '../src/history/git.js';
import { SNAPSHOTS_PATH, VERSIONS_PATH } from '../src/history/index.js';

before(initRepo);
after(eraseRepo);

export async function resetGitRepository() {
  await eraseRepo();
  return initRepo();
}

async function initRepo() {
  for (const repoPath of [VERSIONS_PATH, SNAPSHOTS_PATH]) {
    const git = new Git(repoPath);
    await git.init();
  }
}

async function eraseRepo() {
  const promises = [];

  for (const repoPath of [VERSIONS_PATH, SNAPSHOTS_PATH]) {
    const files = await fs.readdir(repoPath, { withFileTypes: true });

    promises.push(...files.map(file => {
      const filePath = path.join(repoPath, file.name);

      if (file.isDirectory()) {
        return fs.rmdir(filePath, { recursive: true });
      } else if (file.name !== 'README.md') {
        return fs.unlink(filePath);
      }
    }));
  }

  return Promise.all(promises);
}

