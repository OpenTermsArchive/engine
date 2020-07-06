import path from 'path';
import fsApi from 'fs';
const fs = fsApi.promises;

import config from 'config';

import { git } from '../src/history/git.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

before(async () => {
  await git.init();
  git.addConfig('user.name', config.get('history.author').name)
     .addConfig('user.email', config.get('history.author').email);
});

after(() => {
  const DATA_PATH = path.resolve(__dirname, '../', config.get('history.dataPath'), '.git');
  return fs.rmdir(DATA_PATH, { recursive: true });
});
