import path from 'path';
import fsApi from 'fs';

import Git from '../src/history/git.js';
import { SNAPSHOTS_PATH, VERSIONS_PATH } from '../src/history/index.js';

const fs = fsApi.promises;

before(initRepo);
after(eraseRepo);

export async function resetGitRepository() {
  await eraseRepo();
  return initRepo();
}

async function initRepo() {
  for (const repoPath of [ VERSIONS_PATH, SNAPSHOTS_PATH ]) {
    const git = new Git(repoPath);
    await git.init(); /* eslint-disable-line no-await-in-loop */
  }
}

async function eraseRepo() {
  const promises = [];

  for (const repoPath of [ VERSIONS_PATH, SNAPSHOTS_PATH ]) {
    const files = await fs.readdir(repoPath, { withFileTypes: true }); /* eslint-disable-line no-await-in-loop */

    promises.push(...files.map(file => {
      const filePath = path.join(repoPath, file.name);

      if (file.isDirectory()) {
        return fs.rmdir(filePath, { recursive: true });
      } if (file.name !== 'README.md') {
        return fs.unlink(filePath);
      }

      return Promise.resolve();
    }));
  }

  return Promise.all(promises);
}
