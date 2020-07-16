import path from 'path';
import fsApi from 'fs';
const fs = fsApi.promises;

import config from 'config';

import { git } from '../src/history/git.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

before(initRepo);
after(eraseRepo);

export async function resetGitRepository() {
  await eraseRepo();
  return initRepo();
}

async function initRepo() {
  await git.init();
  git.addConfig('user.name', config.get('history.author').name)
     .addConfig('user.email', config.get('history.author').email);
}

async function eraseRepo() {
  const DATA_PATH = path.resolve(__dirname, '../', config.get('history.dataPath'));
  const files = await fs.readdir(DATA_PATH, { withFileTypes: true });

  const promises = files.map(file => {
    const filePath = path.join(DATA_PATH, file.name);

    if (file.isDirectory()) {
      return fs.rmdir(filePath, { recursive: true });
    } else if (file.name !== 'README.md') {
      return fs.unlink(filePath);
    }
  });

  return Promise.all(promises);
}

